/**
 * Opt-in FR-005 file-import live harness.
 *
 *   FR005_INTEGRATION=1 pnpm exec tsx tests/integration/fr005-import.integration.ts --print-target
 *   FR005_INTEGRATION=1 FR005_TARGET_FINGERPRINT=<printed> pnpm exec tsx \
 *     tests/integration/fr005-import.integration.ts --confirm
 *
 * Requires a running app (`FR005_BASE_URL`, default http://localhost:3000).
 * Exit code is non-zero on any failed check or cleanup failure. Fixture
 * references/users are removed; import batches/outcomes are retained as
 * synthetic audit evidence and reported as a manifest.
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import prisma from "../../src/lib/prisma";
import { runSafeCleanup, type PairSafety } from "./fr003-validation";

const BASE_URL = process.env.FR005_BASE_URL || "http://localhost:3000";
const PREFIX = "H7";
const PASSWORD = "H7HarnessPass!2026";

function parseTarget() {
  const direct = process.env.DIRECT_URL;
  const runtime = process.env.DATABASE_URL;
  if (!direct || !runtime) throw new Error("DIRECT_URL and DATABASE_URL are required");
  const d = new URL(direct);
  const r = new URL(runtime);
  const refOf = (u: URL) => (u.username.match(/^postgres\.(.+)$/) || [])[1] ?? "";
  return {
    database: d.pathname.replace(/^\//, "") || "(default)",
    schema: "public",
    fingerprint: crypto
      .createHash("sha256")
      .update(`${refOf(d)}|${d.hostname.toLowerCase()}`)
      .digest("hex")
      .slice(0, 16),
    sameTarget: d.hostname.toLowerCase() === r.hostname.toLowerCase() && refOf(d) === refOf(r),
  };
}

const target = parseTarget();

if (process.argv.includes("--print-target")) {
  console.log(JSON.stringify({ ...target, cliAndRuntimeSameTarget: target.sameTarget }, null, 1));
  process.exit(0);
}
if (process.env.FR005_INTEGRATION !== "1" || (!process.argv.includes("--confirm") && !process.argv.includes("--mixed-source"))) {
  console.error(
    "Refusing to write fixtures. Set FR005_INTEGRATION=1 and pass --confirm or --mixed-source."
  );
  process.exit(2);
}
if (process.env.FR005_TARGET_FINGERPRINT !== target.fingerprint || !target.sameTarget) {
  console.error("Target fingerprint mismatch or CLI/runtime target disagreement. Aborting.");
  process.exit(2);
}

const stamp = Date.now().toString(36).toUpperCase().slice(-6);
const facultyCode = `F${stamp}`;
const programA = `PA${stamp}`;
const programB = `PB${stamp}`;
const courseA = `CA${stamp}`;
const courseB = `CB${stamp}`;
const lecturerNip = `00${String(Date.now()).slice(-8)}`;
const lecturerNidn = `11${String(Date.now()).slice(-8)}`;
const fixtureEmail = `h7.${stamp.toLowerCase()}@harness.test`;
const fixtureAdminEmail = `h7.admin.${stamp.toLowerCase()}@harness.test`;

const checks: string[] = [];
function check(name: string, condition: unknown, detail?: unknown): void {
  if (!condition) {
    throw new Error(`check failed: ${name}${detail === undefined ? "" : ` (${JSON.stringify(detail)})`}`);
  }
  checks.push(name);
}

type Json = unknown;
type Api = { status: number; data: Json };

type Counts = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  conflict: number;
};

type BatchDto = {
  id: string;
  status: string;
  canConfirm: boolean;
  previewCounts: Counts & { columns: string[] };
  resultCounts: Counts | null;
  rows: Array<{
    rowNumber: number;
    action: string;
    originalCells?: unknown[];
    changes?: Record<string, { from: unknown; to: unknown }>;
  }>;
  outcomes: Array<{ rowNumber: number; identity: string; action: string; message: string | null }>;
};

const uncertainRequests: string[] = [];

async function request(
  path: string,
  init: {
    method?: string;
    cookie?: string;
    body?: unknown;
    form?: FormData;
    timeoutMs?: number;
  } = {}
): Promise<Api> {
  const label = `${init.method ?? "GET"} ${path}`;
  try {
    const res = await fetch(BASE_URL + path, {
      method: init.method ?? "GET",
      headers: {
        origin: BASE_URL,
        ...(init.cookie ? { cookie: init.cookie } : {}),
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: AbortSignal.timeout(init.timeoutMs ?? 20000),
    });
    const text = await res.text();
    let data: Json = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 200);
    }
    return { status: res.status, data };
  } catch (error) {
    // A timeout only stops waiting; server work may still be running.
    uncertainRequests.push(label);
    throw error;
  }
}

async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await fetch(BASE_URL + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20000),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (res.status !== 200 || !cookie) throw new Error(`login failed: ${res.status}`);
  return cookie;
}

function seedPasswordFor(email: string): string {
  const seed = fs.readFileSync("prisma/seed.ts", "utf8");
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = seed.match(new RegExp(`email:\\s*"${escaped}"[^}]*password:\\s*"([^"]+)"`, "si"));
  if (!match) throw new Error("development seed password not found");
  return match[1];
}

function csv(headers: string, rows: string[][]): Blob {
  return new Blob([[headers, ...rows.map((row) => row.join(","))].join("\n")], {
    type: "text/csv",
  });
}

async function preview(
  cookie: string,
  source: "SIAT" | "PIPP",
  type: "STUDY_PROGRAMS" | "COURSES" | "LECTURERS",
  fileName: string,
  headers: string,
  rows: string[][],
  status = 201
): Promise<BatchDto> {
  const form = new FormData();
  form.set("source", source);
  form.set("type", type);
  form.set("file", csv(headers, rows), fileName);
  const res = await request("/api/admin/academic-import/preview", {
    method: "POST",
    cookie,
    form,
  });
  check(`${type} ${source} preview status ${status}`, res.status === status, res);
  return res.data as BatchDto;
}

async function confirm(cookie: string, id: string, timeoutMs?: number) {
  return request(`/api/admin/academic-import/${id}/confirm`, {
    method: "POST",
    cookie,
    timeoutMs,
  });
}

async function main() {
  const fixtureUserIds: string[] = [];
  const batchIds: string[] = [];
  const facultyIds: string[] = [];
  const programIds: string[] = [];
  const courseRefIds: string[] = [];
  const lecturerIds: string[] = [];
  const liveEvidence: Record<string, unknown> = {};

  try {
  const adminRow = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  check("bootstrap admin exists", Boolean(adminRow));
  const adminCookie = await login(adminRow!.email, seedPasswordFor(adminRow!.email));

  const catalogCoursesBefore = await prisma.course.count();

  // --- Authentication ---
  const anonList = await request("/api/admin/academic-import");
  check("anonymous list rejected", anonList.status === 401 || anonList.status === 403, anonList.status);
  const anonConfirm = await request("/api/admin/academic-import/fake/confirm", { method: "POST" });
  check("anonymous confirm rejected", anonConfirm.status === 401 || anonConfirm.status === 403);
  const anonForm = new FormData();
  anonForm.set("source", "SIAT");
  anonForm.set("type", "STUDY_PROGRAMS");
  anonForm.set("file", new Blob(["x"], { type: "text/csv" }), "x.csv");
  const anonPreview = await request("/api/admin/academic-import/preview", { method: "POST", form: anonForm });
  check("anonymous preview rejected", anonPreview.status === 401 || anonPreview.status === 403);

  const createUser = await request("/api/admin/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: `${PREFIX} student`,
      email: fixtureEmail,
      password: PASSWORD,
      role: "mahasiswa",
      npm: `22${String(Date.now()).slice(-8)}`,
      academicLevel: "S1",
    },
  });
  check("fixture non-admin created", createUser.status === 201, createUser);
  const fixtureUserId = (createUser.data as { id: string }).id;
  fixtureUserIds.push(fixtureUserId);
  const studentCookie = await login(fixtureEmail);
  const usersBefore = await prisma.user.count();
  const accountsBefore = await prisma.account.count();
  const studentList = await request("/api/admin/academic-import", { cookie: studentCookie });
  check("non-admin list rejected", studentList.status === 403, studentList.status);

  // --- Study programs: mixed valid/invalid, no writes before confirm ---
  const spHeaders = "faculty_code,faculty_name,study_program_code,study_program_name";
  const spRows = [
    [facultyCode, `${PREFIX} Faculty`, programA, `${PREFIX} Program A`],
    [facultyCode, `${PREFIX} Faculty`, programB, `${PREFIX} Program B`],
    ["x", `${PREFIX} Bad`, programB, `${PREFIX} Program Bad`],
  ];
  const spPreview = await preview(adminCookie, "SIAT", "STUDY_PROGRAMS", "h7-programs.csv", spHeaders, spRows);
  batchIds.push(spPreview.id);
  check("program preview allows immediate confirmation", spPreview.canConfirm === true);
  check("program preview counts", spPreview.previewCounts.created === 2 && spPreview.previewCounts.failed === 1, spPreview.previewCounts);
  check("program row numbers preserved", spPreview.rows.map((r) => r.rowNumber).join(",") === "2,3,4");
  check(
    "program preview keeps original cells",
    spPreview.rows[2].originalCells?.[0] === "x",
    spPreview.rows[2].originalCells
  );
  check(
    "program preview writes nothing",
    (await prisma.faculty.count({ where: { code: facultyCode } })) === 0 &&
      (await prisma.studyProgram.count({ where: { code: { in: [programA, programB] } } })) === 0
  );

  const spConfirm = await confirm(adminCookie, spPreview.id);
  check("program confirm status", spConfirm.status === 200, spConfirm);
  const spBatch = spConfirm.data as BatchDto;
  check(
    "program partial result",
    spBatch.status === "PARTIAL" &&
      spBatch.resultCounts?.created === 2 &&
      spBatch.resultCounts?.failed === 1,
    spBatch.resultCounts
  );
  const faculty = await prisma.faculty.findUnique({ where: { code: facultyCode } });
  const programs = await prisma.studyProgram.findMany({ where: { code: { in: [programA, programB] } } });
  if (faculty) facultyIds.push(faculty.id);
  for (const program of programs) programIds.push(program.id);
  check("program references created", Boolean(faculty) && programs.length === 2);
  check("program source recorded", faculty?.source === "SIAT");

  // --- Courses: mixed valid/invalid, reference-only ---
  const courseHeaders = "faculty_code,study_program_code,course_code,course_name,is_active";
  const courseRows = [
    [facultyCode, programA, courseA, `${PREFIX} Course A`, "true"],
    [facultyCode, programA, courseB, `${PREFIX} Course B`, "true"],
    [facultyCode, programA, courseB, `${PREFIX} Course B`, "yes"],
    [facultyCode, `ZZ${stamp}`, `XX${stamp}`, `${PREFIX} Unknown Program`, "true"],
  ];
  const coursePreview = await preview(adminCookie, "PIPP", "COURSES", "h7-courses.csv", courseHeaders, courseRows);
  batchIds.push(coursePreview.id);
  check("course preview counts", coursePreview.previewCounts.created === 2 && coursePreview.previewCounts.failed === 2, coursePreview.previewCounts);
  check("course preview writes nothing", (await prisma.academicCourseReference.count()) === 0);

  const courseConfirm = await confirm(adminCookie, coursePreview.id);
  const courseBatch = courseConfirm.data as BatchDto;
  check(
    "course partial commit",
    courseBatch.status === "PARTIAL" &&
      courseBatch.resultCounts?.created === 2 &&
      courseBatch.resultCounts?.failed === 2,
    courseBatch.resultCounts
  );
  check("course references persist", (await prisma.academicCourseReference.count()) === 2);
  const courseRefs = await prisma.academicCourseReference.findMany({
    where: { studyProgramId: { in: programIds }, courseCode: { in: [courseA, courseB] } },
    select: { id: true },
  });
  for (const reference of courseRefs) courseRefIds.push(reference.id);
  check("catalog Course untouched", (await prisma.course.count()) === catalogCoursesBefore);

  const rePreview = await preview(adminCookie, "PIPP", "COURSES", "h7-courses.csv", courseHeaders, courseRows);
  batchIds.push(rePreview.id);
  check("re-import classifies unchanged", rePreview.previewCounts.updated === 0 && rePreview.previewCounts.unchanged === 2, rePreview.previewCounts);
  const reConfirm = await confirm(adminCookie, rePreview.id);
  const reBatch = reConfirm.data as BatchDto;
  check("re-import creates no duplicates", reBatch.resultCounts?.created === 0 && reBatch.resultCounts?.unchanged === 2, reBatch.resultCounts);
  check("reference count stable after re-import", (await prisma.academicCourseReference.count()) === 2);

  // --- Source precedence, both orders ---
  const siatUpdateA = await preview(
    adminCookie,
    "SIAT",
    "COURSES",
    "h7-siat-a.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Course A SIAT`, "true"]]
  );
  batchIds.push(siatUpdateA.id);
  check("PIPP-owned course may be superseded by SIAT", siatUpdateA.previewCounts.updated === 1, siatUpdateA.previewCounts);
  await confirm(adminCookie, siatUpdateA.id);
  check(
    "SIAT supersede applied",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } }))?.source === "SIAT"
  );

  const pippOverwriteA = await preview(
    adminCookie,
    "PIPP",
    "COURSES",
    "h7-pipp-a.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} PIPP overwrite`, "true"]]
  );
  batchIds.push(pippOverwriteA.id);
  check("PIPP cannot overwrite SIAT-owned course", pippOverwriteA.previewCounts.conflict === 1, pippOverwriteA.previewCounts);
  await confirm(adminCookie, pippOverwriteA.id);
  check(
    "SIAT data survived PIPP attempt",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } }))?.name ===
      `${PREFIX} Course A SIAT`
  );

  // --- Stale preview target is rejected, not silently applied ---
  const stale = await preview(
    adminCookie,
    "SIAT",
    "COURSES",
    "h7-stale.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Stale Proposal`, "true"]]
  );
  batchIds.push(stale.id);
  await prisma.academicCourseReference.updateMany({
    where: { courseCode: courseA },
    data: { name: `${PREFIX} External Edit` },
  });
  const staleConfirm = await confirm(adminCookie, stale.id);
  const staleBatch = staleConfirm.data as BatchDto;
  check(
    "stale preview marked failed",
    staleBatch.status === "PARTIAL" &&
      staleBatch.resultCounts?.failed === 1 &&
      staleBatch.outcomes.some((row) => (row.message ?? "").includes("berubah sejak pratinjau")),
    staleBatch.status
  );
  check(
    "stale preview applied nothing",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } }))?.name ===
      `${PREFIX} External Edit`
  );

  // --- Concurrent confirmations do not duplicate mutations ---
  const concurrent = await preview(
    adminCookie,
    "SIAT",
    "STUDY_PROGRAMS",
    "h7-concurrent.csv",
    spHeaders,
    [[facultyCode, `${PREFIX} Faculty`, programA, `${PREFIX} Program A Concurrent`]]
  );
  batchIds.push(concurrent.id);
  const [first, second] = await Promise.all([
    confirm(adminCookie, concurrent.id),
    confirm(adminCookie, concurrent.id),
  ]);
  check("concurrent confirm responses controlled", [200, 409].includes(first.status) && [200, 409].includes(second.status), [first.status, second.status]);
  const concurrentBatch = await prisma.academicImportBatch.findUnique({
    where: { id: concurrent.id },
    include: { outcomes: true },
  });
  check("concurrent confirm final status", concurrentBatch?.status === "CONFIRMED", concurrentBatch?.status);
  check("concurrent confirm one outcome per row", concurrentBatch?.outcomes.length === 1, concurrentBatch?.outcomes.length);
  check(
    "concurrent confirm applied once",
    (await prisma.studyProgram.findFirst({ where: { code: programA } }))?.name ===
      `${PREFIX} Program A Concurrent`
  );

  // --- Lecturers: reference only, leading zeros, no accounts ---
  const lecturerHeaders = "nip,nidn,name,email,is_active";
  const lecturerRows = [
    [lecturerNip, lecturerNidn, `${PREFIX} Lecturer`, fixtureEmail, "true"],
    ["1234567", "", `${PREFIX} Invalid Lecturer`, "", "true"],
  ];
  const lecturerPreview = await preview(adminCookie, "SIAT", "LECTURERS", "h7-lecturers.csv", lecturerHeaders, lecturerRows);
  batchIds.push(lecturerPreview.id);
  check("lecturer preview counts", lecturerPreview.previewCounts.created === 1 && lecturerPreview.previewCounts.failed === 1, lecturerPreview.previewCounts);
  check("lecturer preview creates no auth rows", (await prisma.user.count()) === usersBefore && (await prisma.account.count()) === accountsBefore);
  const lecturerConfirm = await confirm(adminCookie, lecturerPreview.id);
  check("lecturer confirm partial", (lecturerConfirm.data as BatchDto).status === "PARTIAL");
  const lecturer = await prisma.lecturerReference.findFirst({ where: { nip: lecturerNip } });
  if (lecturer) lecturerIds.push(lecturer.id);
  check("lecturer reference keeps leading zeros", lecturer?.nip === lecturerNip, lecturer?.nip);
  check("lecturer import creates no user", (await prisma.user.count()) === usersBefore);
  check(
    "lecturer import creates no user with identifiers",
    (await prisma.user.count({ where: { OR: [{ nip: lecturerNip }, { nidn: lecturerNidn }] } })) === 0
  );
  const lecturerRe = await preview(adminCookie, "SIAT", "LECTURERS", "h7-lecturers.csv", lecturerHeaders, lecturerRows);
  batchIds.push(lecturerRe.id);
  check("lecturer re-import unchanged", lecturerRe.previewCounts.unchanged === 1 && lecturerRe.previewCounts.created === 0, lecturerRe.previewCounts);
  await confirm(adminCookie, lecturerRe.id);
  check("lecturer no duplicate", (await prisma.lecturerReference.count({ where: { nip: lecturerNip } })) === 1);

  // --- SIAT provenance promotion on identical business values ---
  const promotion = await preview(
    adminCookie,
    "SIAT",
    "COURSES",
    "h7-promotion.csv",
    courseHeaders,
    [[facultyCode, programA, courseB, `${PREFIX} Course B`, "true"]]
  );
  batchIds.push(promotion.id);
  check(
    "identical SIAT import previews provenance promotion",
    promotion.previewCounts.updated === 1 && promotion.rows[0].changes?.source?.to === "SIAT",
    promotion.previewCounts
  );
  await confirm(adminCookie, promotion.id);
  check(
    "SIAT provenance promotion persisted",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseB } }))?.source === "SIAT"
  );
  const pippAfterPromotion = await preview(
    adminCookie,
    "PIPP",
    "COURSES",
    "h7-promotion-pipp.csv",
    courseHeaders,
    [[facultyCode, programA, courseB, `${PREFIX} PIPP After Promotion`, "true"]]
  );
  batchIds.push(pippAfterPromotion.id);
  check(
    "promoted SIAT data blocks PIPP overwrite",
    pippAfterPromotion.previewCounts.conflict === 1,
    pippAfterPromotion.previewCounts
  );
  await confirm(adminCookie, pippAfterPromotion.id);
  check(
    "promoted SIAT value survives PIPP attempt",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseB } }))?.name ===
      `${PREFIX} Course B`
  );

  // --- Shared parent rename with two valid program rows ---
  const shared = await preview(
    adminCookie,
    "SIAT",
    "STUDY_PROGRAMS",
    "h7-shared-parent.csv",
    spHeaders,
    [
      [facultyCode, `${PREFIX} Faculty Renamed`, programA, `${PREFIX} Program A Renamed`],
      [facultyCode, `${PREFIX} Faculty Renamed`, programB, `${PREFIX} Program B Renamed`],
    ]
  );
  batchIds.push(shared.id);
  check(
    "shared parent rename previews both rows",
    shared.previewCounts.updated === 2,
    shared.previewCounts
  );
  const sharedConfirm = await confirm(adminCookie, shared.id);
  check(
    "shared parent rename commits both rows",
    (sharedConfirm.data as BatchDto).resultCounts?.updated === 2 &&
      (sharedConfirm.data as BatchDto).resultCounts?.failed === 0,
    sharedConfirm.data
  );
  check(
    "shared parent rename persisted",
    (await prisma.faculty.findUnique({ where: { code: facultyCode } }))?.name ===
      `${PREFIX} Faculty Renamed`
  );
  check(
    "both shared programs renamed",
    (await prisma.studyProgram.count({
      where: {
        code: { in: [programA, programB] },
        name: { in: [`${PREFIX} Program A Renamed`, `${PREFIX} Program B Renamed`] },
      },
    })) === 2
  );

  // --- Two different batches target the same existing reference ---
  async function resetCourseA(name: string) {
    await prisma.academicCourseReference.updateMany({
      where: { courseCode: courseA },
      data: { name },
    });
  }

  async function orderedPair(order: "forward" | "reverse") {
    const base = `${PREFIX} Race ${order} Base`;
    await resetCourseA(base);
    const first = await preview(
      adminCookie,
      "SIAT",
      "COURSES",
      `h7-race-${order}-1.csv`,
      courseHeaders,
      [[facultyCode, programA, courseA, `${PREFIX} Race ${order} First`, "true"]]
    );
    const second = await preview(
      adminCookie,
      "SIAT",
      "COURSES",
      `h7-race-${order}-2.csv`,
      courseHeaders,
      [[facultyCode, programA, courseA, `${PREFIX} Race ${order} Second`, "true"]]
    );
    batchIds.push(first.id, second.id);
    const sequence = order === "forward" ? [first, second] : [second, first];
    const responses = [];
    for (const batch of sequence) {
      responses.push(await confirm(adminCookie, batch.id));
    }
    check(
      `ordered pair ${order} responses controlled`,
      responses.every((response) => response.status === 200),
      responses.map((response) => response.status)
    );
    check(
      `ordered pair ${order} one stale rejection`,
      responses[0].status === 200 &&
        (responses[0].data as BatchDto).status === "CONFIRMED" &&
        (responses[1].data as BatchDto).status === "PARTIAL" &&
        (responses[1].data as BatchDto).resultCounts?.failed === 1,
      responses.map((response) => (response.data as BatchDto).status)
    );
    return (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } }))?.name;
  }

  check("forward ordering first batch wins", (await orderedPair("forward")) === `${PREFIX} Race forward First`);
  check("reverse ordering second-created batch wins", (await orderedPair("reverse")) === `${PREFIX} Race reverse Second`);

  await resetCourseA(`${PREFIX} Race Concurrent Base`);
  const concurrentA = await preview(
    adminCookie,
    "SIAT",
    "COURSES",
    "h7-race-concurrent-a.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Race Concurrent A`, "true"]]
  );
  const concurrentB = await preview(
    adminCookie,
    "SIAT",
    "COURSES",
    "h7-race-concurrent-b.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Race Concurrent B`, "true"]]
  );
  batchIds.push(concurrentA.id, concurrentB.id);
  const [raceA, raceB] = await Promise.all([
    confirm(adminCookie, concurrentA.id),
    confirm(adminCookie, concurrentB.id),
  ]);
  const raceStatuses = [raceA, raceB].map((response) => (response.data as BatchDto).status).sort();
  check(
    "concurrent distinct batches serialize",
    raceStatuses.join(",") === "CONFIRMED,PARTIAL",
    raceStatuses
  );
  const concurrentWinner = (
    await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } })
  )?.name;
  check(
    "concurrent distinct batches leave exactly one winner",
    concurrentWinner === `${PREFIX} Race Concurrent A` ||
      concurrentWinner === `${PREFIX} Race Concurrent B`,
    concurrentWinner
  );

  // --- Persisted expiration after rejected confirmation ---
  const currentFaculty = await prisma.faculty.findUnique({ where: { code: facultyCode } });
  const expiring = await preview(
    adminCookie,
    "SIAT",
    "STUDY_PROGRAMS",
    "h7-expired.csv",
    spHeaders,
    [[facultyCode, currentFaculty!.name, programA, `${PREFIX} Expired Proposal`]]
  );
  batchIds.push(expiring.id);
  await prisma.academicImportBatch.update({
    where: { id: expiring.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expiredConfirm = await confirm(adminCookie, expiring.id);
  check("expired confirmation rejected", expiredConfirm.status === 409, expiredConfirm);
  check(
    "expired state persisted",
    (await prisma.academicImportBatch.findUnique({ where: { id: expiring.id } }))?.status === "EXPIRED"
  );
  check(
    "expired confirmation applied no business change",
    (await prisma.studyProgram.findFirst({ where: { code: programA } }))?.name !==
      `${PREFIX} Expired Proposal`
  );

  // --- Fixture-admin ownership and revocation ---
  const createAdmin = await request("/api/admin/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: `${PREFIX} fixture admin`,
      email: fixtureAdminEmail,
      password: PASSWORD,
      role: "admin",
    },
  });
  check("fixture admin created", createAdmin.status === 201, createAdmin);
  const fixtureAdminId = (createAdmin.data as { id: string }).id;
  fixtureUserIds.push(fixtureAdminId);
  const fixtureAdminCookie = await login(fixtureAdminEmail);
  const owned = await preview(
    fixtureAdminCookie,
    "SIAT",
    "COURSES",
    "h7-owned.csv",
    courseHeaders,
    [[facultyCode, programA, courseB, `${PREFIX} Owned Proposal`, "true"]]
  );
  batchIds.push(owned.id);
  const foreignConfirm = await confirm(adminCookie, owned.id);
  check("non-creator cannot confirm a preview", foreignConfirm.status === 403, foreignConfirm);
  const demote = await request(`/api/admin/users/${fixtureAdminId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { role: "mahasiswa", npm: `33${String(Date.now()).slice(-8)}`, academicLevel: "S1" },
  });
  check("fixture admin demoted", demote.status === 200, demote);
  const revokedConfirm = await confirm(fixtureAdminCookie, owned.id);
  check("revoked actor cannot confirm", revokedConfirm.status === 403, revokedConfirm);
  check(
    "revoked actor applied no business change",
    (await prisma.academicCourseReference.findFirst({ where: { courseCode: courseB } }))?.name ===
      `${PREFIX} Course B`
  );

  // --- Adopt an existing faculty with no code using two valid rows ---
  const adoptFacultyCode = `A${stamp}`;
  const adoptProgramA = `QA${stamp}`;
  const adoptProgramB = `QB${stamp}`;
  const adoptFaculty = await prisma.faculty.create({
    data: {
      id: crypto.randomUUID(),
      name: `${PREFIX} Adopt Faculty`,
      code: null,
      source: "PIPP",
    },
  });
  facultyIds.push(adoptFaculty.id);
  const adoptPreview = await preview(
    adminCookie,
    "SIAT",
    "STUDY_PROGRAMS",
    "h7-adopt.csv",
    spHeaders,
    [
      [adoptFacultyCode, `${PREFIX} Adopt Faculty`, adoptProgramA, `${PREFIX} Adopt Program A`],
      [adoptFacultyCode, `${PREFIX} Adopt Faculty`, adoptProgramB, `${PREFIX} Adopt Program B`],
    ]
  );
  batchIds.push(adoptPreview.id);
  check(
    "faculty adoption previewed as explicit parent change",
    adoptPreview.previewCounts.created === 2 &&
      adoptPreview.rows.every((row) => row.changes?.facultyAdopted?.to === true),
    adoptPreview.previewCounts
  );
  const adoptConfirm = await confirm(adminCookie, adoptPreview.id);
  const adoptedFacultyRow = await prisma.faculty.findUnique({
    where: { id: adoptFaculty.id },
    select: { code: true, source: true },
  });
  check(
    "faculty adoption persisted",
    adoptedFacultyRow?.code === adoptFacultyCode,
    { adoptedFacultyRow, adoptBatch: adoptConfirm.data }
  );
  const adoptedPrograms = await prisma.studyProgram.findMany({
    where: { code: { in: [adoptProgramA, adoptProgramB] } },
    select: { id: true },
  });
  for (const program of adoptedPrograms) programIds.push(program.id);
  check("adopted faculty has two programs", adoptedPrograms.length === 2);

  // --- Cross-actor target lock with real PostgreSQL synchronization ---
  async function createFixtureAdmin(label: string, email: string) {
    const response = await request("/api/admin/users", {
      method: "POST",
      cookie: adminCookie,
      body: {
        name: `${PREFIX} ${label}`,
        email,
        password: PASSWORD,
        role: "admin",
      },
    });
    check(`${label} created`, response.status === 201, response);
    const id = (response.data as { id: string }).id;
    fixtureUserIds.push(id);
    return { id, cookie: await login(email) };
  }

  const adminA = await createFixtureAdmin(
    "cross actor A",
    `h7.actor.a.${stamp.toLowerCase()}@harness.test`
  );
  const adminB = await createFixtureAdmin(
    "cross actor B",
    `h7.actor.b.${stamp.toLowerCase()}@harness.test`
  );

  await resetCourseA(`${PREFIX} Cross Actor Base`);
  const crossTarget = await prisma.academicCourseReference.findFirst({
    where: { courseCode: courseA },
    select: { id: true },
  });
  check("cross-actor target exists", Boolean(crossTarget));

  const crossA = await preview(
    adminA.cookie,
    "SIAT",
    "COURSES",
    "h7-cross-actor-a.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Cross Actor A`, "true"]]
  );
  const crossB = await preview(
    adminB.cookie,
    "SIAT",
    "COURSES",
    "h7-cross-actor-b.csv",
    courseHeaders,
    [[facultyCode, programA, courseA, `${PREFIX} Cross Actor B`, "true"]]
  );
  batchIds.push(crossA.id, crossB.id);

  let releaseBlocker!: () => void;
  const blockerRelease = new Promise<void>((resolve) => {
    releaseBlocker = resolve;
  });
  let announceLocked!: () => void;
  const blockerReady = new Promise<void>((resolve) => {
    announceLocked = resolve;
  });
  let blockerXid = "";
  const blocker = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "academic_course_reference" WHERE "id" = ${crossTarget!.id} FOR UPDATE
      `;
      const [xid] = await tx.$queryRaw<Array<{ xid: string }>>`
        SELECT txid_current()::text AS xid
      `;
      blockerXid = xid.xid;
      announceLocked();
      await blockerRelease;
    },
    { timeout: 30000, maxWait: 10000 }
  );

  let confirmA: Promise<Api> | undefined;
  let confirmB: Promise<Api> | undefined;
  try {
    await blockerReady;
    confirmA = confirm(adminA.cookie, crossA.id, 60000);
    confirmB = confirm(adminB.cookie, crossB.id, 60000);
    confirmA.catch(() => undefined);
    confirmB.catch(() => undefined);

    let maxWaiters = 0;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const claimed = await prisma.academicImportBatch.findMany({
        where: { id: { in: [crossA.id, crossB.id] } },
        select: { status: true },
      });
      if (claimed.length === 2 && claimed.every((batch) => batch.status === "CONFIRMING")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const [waiter] = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
        FROM pg_locks
        WHERE NOT granted
          AND locktype = 'transactionid'
          AND transactionid::text = ${blockerXid}
      `;
      maxWaiters = Math.max(maxWaiters, Number(waiter.count));
      if (maxWaiters >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    liveEvidence.crossActorTargetLockWaiters = maxWaiters;
    liveEvidence.crossActorActorsDistinct = adminA.id !== adminB.id;
    check(
      "two distinct actors wait on the fixture blocker transaction",
      maxWaiters >= 2,
      maxWaiters
    );

    releaseBlocker();
    await blocker;
    const [crossResponseA, crossResponseB] = await Promise.all([confirmA, confirmB]);
    check(
      "cross-actor confirmations both controlled",
      crossResponseA.status === 200 && crossResponseB.status === 200,
      [crossResponseA.status, crossResponseB.status]
    );
    const crossStatuses = [
      (crossResponseA.data as BatchDto).status,
      (crossResponseB.data as BatchDto).status,
    ].sort();
    check(
      "cross-actor confirmations serialize to one committed write",
      crossStatuses.join(",") === "CONFIRMED,PARTIAL",
      crossStatuses
    );
    const crossWinner = (
      await prisma.academicCourseReference.findFirst({ where: { courseCode: courseA } })
    )?.name;
    check(
      "cross-actor final state has one winner",
      crossWinner === `${PREFIX} Cross Actor A` ||
        crossWinner === `${PREFIX} Cross Actor B`,
      crossWinner
    );
    liveEvidence.crossActorStatuses = crossStatuses;
    liveEvidence.crossActorWinner = crossWinner;
  } finally {
    releaseBlocker();
    await blocker.catch(() => undefined);
    if (confirmA && confirmB) {
      await Promise.allSettled([confirmA, confirmB]);
    }
  }

  console.log(
    JSON.stringify(
      {
        target,
        checks: checks.length,
        batches: batchIds,
        liveEvidence,
        retainedEvidence: "academic_import_batch + academic_import_row_outcome rows retained",
      },
      null,
      1
    )
  );
} finally {
  const safety: PairSafety = {
    blockerReleased: true,
    releaseUncertain: false,
    operationsSettled: uncertainRequests.length === 0,
    failures: uncertainRequests.map((operation) => `uncertain completion: ${operation}`),
    cleanupSafe: uncertainRequests.length === 0,
  };
  const ownershipManifest = {
    fixtureUserIds: [...fixtureUserIds],
    facultyIds: [...facultyIds],
    programIds: [...programIds],
    courseRefIds: [...courseRefIds],
    lecturerIds: [...lecturerIds],
    retainedBatchIds: [...batchIds],
  };
  const cleanupErrors: string[] = [];

  const cleanup = async () => {
    const [facultyRows, programRows, courseRows, lecturerRows] = await Promise.all([
      prisma.faculty.findMany({
        where: { OR: [{ id: { in: facultyIds } }, { code: facultyCode }] },
        select: { id: true },
      }),
      prisma.studyProgram.findMany({
        where: {
          code: { in: [programA, programB, `QA${stamp}`, `QB${stamp}`] },
          name: { startsWith: PREFIX },
        },
        select: { id: true },
      }),
      prisma.academicCourseReference.findMany({
        where: {
          courseCode: { in: [courseA, courseB] },
          name: { startsWith: PREFIX },
        },
        select: { id: true },
      }),
      prisma.lecturerReference.findMany({
        where: { nip: lecturerNip, nidn: lecturerNidn },
        select: { id: true },
      }),
    ]);
    const ids = (recorded: string[], found: Array<{ id: string }>) =>
      [...new Set([...recorded, ...found.map((row) => row.id)])];
    const allCourseIds = ids(courseRefIds, courseRows);
    const allLecturerIds = ids(lecturerIds, lecturerRows);
    const allProgramIds = ids(programIds, programRows);
    const allFacultyIds = ids(facultyIds, facultyRows);

    try {
      if (allCourseIds.length > 0) {
        await prisma.academicCourseReference.deleteMany({ where: { id: { in: allCourseIds } } });
      }
    } catch (error) {
      cleanupErrors.push(`course refs: ${String(error)}`);
    }
    try {
      if (allLecturerIds.length > 0) {
        await prisma.lecturerReference.deleteMany({ where: { id: { in: allLecturerIds } } });
      }
    } catch (error) {
      cleanupErrors.push(`lecturer refs: ${String(error)}`);
    }
    try {
      if (allProgramIds.length > 0) {
        await prisma.studyProgram.deleteMany({ where: { id: { in: allProgramIds } } });
      }
    } catch (error) {
      cleanupErrors.push(`programs: ${String(error)}`);
    }
    try {
      if (allFacultyIds.length > 0) {
        await prisma.faculty.deleteMany({ where: { id: { in: allFacultyIds } } });
      }
    } catch (error) {
      cleanupErrors.push(`faculty: ${String(error)}`);
    }
    try {
      if (fixtureUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
      }
    } catch (error) {
      cleanupErrors.push(`fixture users: ${String(error)}`);
    }
  };

  const outcome = await runSafeCleanup([safety], cleanup);
  if (!outcome.decision.allowed) {
    console.error(
      JSON.stringify({
        deferredCleanup: true,
        reason: outcome.decision.reason,
        ownershipManifest,
      })
    );
    process.exitCode = 1;
  } else if (cleanupErrors.length > 0) {
    console.error(JSON.stringify({ cleanupErrors, ownershipManifest }));
    process.exitCode = 1;
  }
}
}

/**
 * Focused mixed-source concurrency evidence. Uses one PIPP-owned fixture
 * reference, one SIAT batch and one PIPP batch, each confirmed by a distinct
 * fixture admin. Synchronization evidence is scoped to the fixture blocker's
 * transaction id, never a database-wide table/query count.
 */
async function runMixedSource() {
  const fixtureUserIds: string[] = [];
  const batchIds: string[] = [];
  const facultyIds: string[] = [];
  const programIds: string[] = [];
  const courseRefIds: string[] = [];
  const liveEvidence: Record<string, unknown> = {};
  const headers = "faculty_code,study_program_code,course_code,course_name,is_active";
  const mixedFacultyCode = `MF${stamp}`;
  const mixedProgramCode = `MP${stamp}`;
  const mixedCourseCode = `MC${stamp}`;
  const safety: PairSafety = {
    blockerReleased: true,
    releaseUncertain: false,
    operationsSettled: false,
    failures: [],
    cleanupSafe: false,
  };

  try {
    const bootstrap = await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    check("mixed bootstrap admin exists", Boolean(bootstrap));
    const adminCookie = await login(bootstrap!.email, seedPasswordFor(bootstrap!.email));

    async function createFixtureAdmin(label: string, email: string) {
      const response = await request("/api/admin/users", {
        method: "POST",
        cookie: adminCookie,
        body: { name: `${PREFIX} ${label}`, email, password: PASSWORD, role: "admin" },
      });
      check(`${label} created`, response.status === 201, response);
      const id = (response.data as { id: string }).id;
      fixtureUserIds.push(id);
      return { id, cookie: await login(email) };
    }

    const siatAdmin = await createFixtureAdmin(
      "mixed siat actor",
      `h7.mixed.siat.${stamp.toLowerCase()}@harness.test`
    );
    const pippAdmin = await createFixtureAdmin(
      "mixed pipp actor",
      `h7.mixed.pipp.${stamp.toLowerCase()}@harness.test`
    );
    check("mixed actors are distinct", siatAdmin.id !== pippAdmin.id);

    const mixedFaculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: `${PREFIX} Mixed Faculty`,
        code: mixedFacultyCode,
        source: "PIPP",
      },
    });
    facultyIds.push(mixedFaculty.id);
    const mixedProgram = await prisma.studyProgram.create({
      data: {
        id: crypto.randomUUID(),
        facultyId: mixedFaculty.id,
        name: `${PREFIX} Mixed Program`,
        code: mixedProgramCode,
        source: "PIPP",
      },
    });
    programIds.push(mixedProgram.id);
    const mixedCourse = await prisma.academicCourseReference.create({
      data: {
        id: crypto.randomUUID(),
        studyProgramId: mixedProgram.id,
        courseCode: mixedCourseCode,
        name: `${PREFIX} Mixed Base`,
        isActive: true,
        source: "PIPP",
      },
    });
    courseRefIds.push(mixedCourse.id);

    async function resetMixedCourse(name: string) {
      await prisma.academicCourseReference.update({
        where: { id: mixedCourse.id },
        data: { name, source: "PIPP" },
      });
    }

    async function mixedPreview(
      actor: { cookie: string },
      source: "SIAT" | "PIPP",
      fileName: string,
      name: string
    ) {
      const batch = await preview(actor.cookie, source, "COURSES", fileName, headers, [
        [mixedFacultyCode, mixedProgramCode, mixedCourseCode, name, "true"],
      ]);
      batchIds.push(batch.id);
      return batch;
    }

    const currentCourse = async () =>
      prisma.academicCourseReference.findUnique({
        where: { id: mixedCourse.id },
        select: { name: true, source: true },
      });

    // --- Deterministic SIAT-first: committed SIAT cannot be overwritten by PIPP ---
    await resetMixedCourse(`${PREFIX} Mixed Base`);
    const siatFirst = await mixedPreview(
      siatAdmin,
      "SIAT",
      "h7-mixed-siat-first.csv",
      `${PREFIX} Mixed SIAT First`
    );
    const pippStale = await mixedPreview(
      pippAdmin,
      "PIPP",
      "h7-mixed-pipp-stale.csv",
      `${PREFIX} Mixed PIPP Stale`
    );
    const siatFirstConfirm = await confirm(siatAdmin.cookie, siatFirst.id);
    check(
      "mixed SIAT-first SIAT confirm",
      (siatFirstConfirm.data as BatchDto).status === "CONFIRMED",
      siatFirstConfirm
    );
    const pippStaleConfirm = await confirm(pippAdmin.cookie, pippStale.id);
    const pippStaleBatch = pippStaleConfirm.data as BatchDto;
    const pippStaleRejected =
      pippStaleBatch.resultCounts?.failed === 1 ||
      pippStaleBatch.resultCounts?.conflict === 1;
    check(
      "mixed PIPP cannot overwrite committed SIAT",
      pippStaleConfirm.status === 200 &&
        pippStaleBatch.status === "PARTIAL" &&
        pippStaleRejected,
      pippStaleBatch.resultCounts
    );
    check(
      "mixed SIAT-first final value retained",
      JSON.stringify(await currentCourse()) ===
        JSON.stringify({ name: `${PREFIX} Mixed SIAT First`, source: "SIAT" }),
      await currentCourse()
    );
    liveEvidence.siatFirstPippOutcome = pippStaleBatch.outcomes?.[0]?.action ?? null;

    // Fresh preview after the SIAT commit still cannot be confirmed by PIPP.
    const pippRepreview = await mixedPreview(
      pippAdmin,
      "PIPP",
      "h7-mixed-pipp-repreview.csv",
      `${PREFIX} Mixed PIPP Repreview`
    );
    const pippRepreviewConfirm = await confirm(pippAdmin.cookie, pippRepreview.id);
    const pippRepreviewBatch = pippRepreviewConfirm.data as BatchDto;
    check(
      "mixed PIPP re-preview stays a controlled conflict",
      pippRepreviewConfirm.status === 200 &&
        pippRepreviewBatch.status === "PARTIAL" &&
        pippRepreviewBatch.resultCounts?.conflict === 1,
      pippRepreviewBatch.resultCounts
    );
    check(
      "mixed re-preview did not overwrite SIAT",
      (await currentCourse())?.name === `${PREFIX} Mixed SIAT First`,
      await currentCourse()
    );

    // --- Deterministic PIPP-first: SIAT precedence still promotes, no FIFO claim ---
    await resetMixedCourse(`${PREFIX} Mixed PIPP Base`);
    const pippFirst = await mixedPreview(
      pippAdmin,
      "PIPP",
      "h7-mixed-pipp-first.csv",
      `${PREFIX} Mixed PIPP First`
    );
    const siatSecond = await mixedPreview(
      siatAdmin,
      "SIAT",
      "h7-mixed-siat-second.csv",
      `${PREFIX} Mixed SIAT Second`
    );
    const pippFirstConfirm = await confirm(pippAdmin.cookie, pippFirst.id);
    check(
      "mixed PIPP-first PIPP confirm",
      (pippFirstConfirm.data as BatchDto).status === "CONFIRMED",
      pippFirstConfirm
    );
    const siatSecondConfirm = await confirm(siatAdmin.cookie, siatSecond.id);
    const siatSecondBatch = siatSecondConfirm.data as BatchDto;
    check(
      "mixed PIPP-first SIAT stale requires re-preview",
      siatSecondConfirm.status === 200 &&
        siatSecondBatch.status === "PARTIAL" &&
        siatSecondBatch.resultCounts?.failed === 1,
      siatSecondBatch.resultCounts
    );
    check(
      "mixed PIPP-first stale SIAT applied no write",
      (await currentCourse())?.name === `${PREFIX} Mixed PIPP First`,
      await currentCourse()
    );
    const siatRepreview = await mixedPreview(
      siatAdmin,
      "SIAT",
      "h7-mixed-siat-repreview.csv",
      `${PREFIX} Mixed SIAT Repreview`
    );
    const siatRepreviewConfirm = await confirm(siatAdmin.cookie, siatRepreview.id);
    check(
      "mixed SIAT re-preview promotes over PIPP",
      (siatRepreviewConfirm.data as BatchDto).status === "CONFIRMED" &&
        (siatRepreviewConfirm.data as BatchDto).resultCounts?.updated === 1,
      siatRepreviewConfirm.data
    );
    check(
      "mixed PIPP-first final value is SIAT",
      JSON.stringify(await currentCourse()) ===
        JSON.stringify({ name: `${PREFIX} Mixed SIAT Repreview`, source: "SIAT" }),
      await currentCourse()
    );
    liveEvidence.pippFirstFinal = await currentCourse();

    // --- Concurrent SIAT/PIPP with fixture-scoped PostgreSQL contention ---
    await resetMixedCourse(`${PREFIX} Mixed Concurrent Base`);
    const siatConcurrent = await mixedPreview(
      siatAdmin,
      "SIAT",
      "h7-mixed-siat-concurrent.csv",
      `${PREFIX} Mixed SIAT Concurrent`
    );
    const pippConcurrent = await mixedPreview(
      pippAdmin,
      "PIPP",
      "h7-mixed-pipp-concurrent.csv",
      `${PREFIX} Mixed PIPP Concurrent`
    );

    let releaseBlocker!: () => void;
    const blockerRelease = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    let announceLocked!: () => void;
    const blockerReady = new Promise<void>((resolve) => {
      announceLocked = resolve;
    });
    let blockerXid = "";
    let blockerPid = 0;
    safety.blockerReleased = false;
    const blocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "academic_course_reference" WHERE "id" = ${mixedCourse.id} FOR UPDATE
        `;
        const [info] = await tx.$queryRaw<Array<{ pid: number; xid: string }>>`
          SELECT pg_backend_pid()::int AS pid, txid_current()::text AS xid
        `;
        blockerPid = Number(info.pid);
        blockerXid = info.xid;
        announceLocked();
        await blockerRelease;
      },
      { timeout: 60000, maxWait: 10000 }
    );

    let confirmSiat: Promise<Api> | undefined;
    let confirmPipp: Promise<Api> | undefined;
    try {
      await blockerReady;
      confirmSiat = confirm(siatAdmin.cookie, siatConcurrent.id, 60000);
      confirmPipp = confirm(pippAdmin.cookie, pippConcurrent.id, 60000);
      confirmSiat.catch(() => undefined);
      confirmPipp.catch(() => undefined);

      const deadline = Date.now() + 25000;
      let bothConfirming = false;
      let maxWaiters = 0;
      while (Date.now() < deadline) {
        const claimed = await prisma.academicImportBatch.findMany({
          where: { id: { in: [siatConcurrent.id, pippConcurrent.id] } },
          select: { status: true },
        });
        bothConfirming =
          claimed.length === 2 && claimed.every((batch) => batch.status === "CONFIRMING");
        if (bothConfirming) {
          // Walk the fixture blocker's lock-wait chain: later waiters queue
          // behind earlier waiters, not directly behind the blocker.
          const waiters = await prisma.$queryRaw<
            Array<{ pid: number; blockers: number[] }>
          >`
            SELECT pid, pg_blocking_pids(pid) AS blockers
            FROM pg_stat_activity
            WHERE cardinality(pg_blocking_pids(pid)) > 0
          `;
          const byPid = new Map<number, number[]>();
          for (const row of waiters) {
            byPid.set(Number(row.pid), (row.blockers ?? []).map(Number));
          }
          const visited = new Set<number>([blockerPid]);
          let frontier = [blockerPid];
          let chain = 0;
          while (frontier.length > 0) {
            const next: number[] = [];
            for (const [pid, blockers] of byPid) {
              if (visited.has(pid)) continue;
              if (blockers.some((blocker) => frontier.includes(blocker))) {
                visited.add(pid);
                next.push(pid);
                chain += 1;
              }
            }
            frontier = next;
          }
          maxWaiters = Math.max(maxWaiters, chain);
        }
        if (bothConfirming && maxWaiters >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      liveEvidence.mixedLockWaiters = maxWaiters;
      liveEvidence.mixedBlockerXid = blockerXid;
      check(
        "both mixed actors wait on the fixture blocker transaction",
        maxWaiters >= 2,
        { maxWaiters, bothConfirming }
      );

      releaseBlocker();
      await blocker;
      safety.blockerReleased = true;
      const [siatResponse, pippResponse] = await Promise.all([confirmSiat, confirmPipp]);
      const statuses = [
        (siatResponse.data as BatchDto).status,
        (pippResponse.data as BatchDto).status,
      ];
      check(
        "mixed concurrent confirmations controlled",
        siatResponse.status === 200 &&
          pippResponse.status === 200 &&
          statuses.every((status) => status === "CONFIRMED" || status === "PARTIAL"),
        statuses
      );
      const concurrentFinal = await currentCourse();
      const concurrentWinner =
        concurrentFinal?.name === `${PREFIX} Mixed SIAT Concurrent` ||
        concurrentFinal?.name === `${PREFIX} Mixed PIPP Concurrent`;
      check(
        "mixed concurrent final state has one controlled winner",
        concurrentWinner &&
          statuses.includes("CONFIRMED") &&
          statuses.includes("PARTIAL"),
        { concurrentFinal, statuses }
      );
      liveEvidence.mixedStatuses = statuses;
      liveEvidence.mixedFinal = concurrentFinal;
    } finally {
      releaseBlocker();
      try {
        await blocker;
        safety.blockerReleased = true;
      } catch (error) {
        safety.releaseUncertain = true;
        safety.failures.push(`blocker release uncertain: ${String(error)}`);
      }
      if (confirmSiat && confirmPipp) {
        const drained = await Promise.allSettled([confirmSiat, confirmPipp]);
        const rejected = drained.filter((entry) => entry.status === "rejected");
        if (rejected.length > 0) {
          safety.failures.push(`operation drain failed: ${String(rejected[0])}`);
        }
      }
    }
  } finally {
    safety.operationsSettled = uncertainRequests.length === 0 && safety.failures.length === 0;
    safety.cleanupSafe =
      safety.blockerReleased && safety.operationsSettled && !safety.releaseUncertain;
    const ownershipManifest = {
      fixtureUserIds: [...fixtureUserIds],
      facultyIds: [...facultyIds],
      programIds: [...programIds],
      courseRefIds: [...courseRefIds],
      retainedBatchIds: [...batchIds],
    };
    const cleanupErrors: string[] = [];

    const cleanup = async () => {
      const [facultyRows, programRows, courseRows] = await Promise.all([
        prisma.faculty.findMany({
          where: { OR: [{ id: { in: facultyIds } }, { code: mixedFacultyCode }] },
          select: { id: true },
        }),
        prisma.studyProgram.findMany({
          where: { OR: [{ id: { in: programIds } }, { code: mixedProgramCode }] },
          select: { id: true },
        }),
        prisma.academicCourseReference.findMany({
          where: { OR: [{ id: { in: courseRefIds } }, { courseCode: mixedCourseCode }] },
          select: { id: true },
        }),
      ]);
      const ids = (recorded: string[], found: Array<{ id: string }>) =>
        [...new Set([...recorded, ...found.map((row) => row.id)])];
      const allCourseIds = ids(courseRefIds, courseRows);
      const allProgramIds = ids(programIds, programRows);
      const allFacultyIds = ids(facultyIds, facultyRows);

      try {
        if (allCourseIds.length > 0) {
          await prisma.academicCourseReference.deleteMany({ where: { id: { in: allCourseIds } } });
        }
      } catch (error) {
        cleanupErrors.push(`course refs: ${String(error)}`);
      }
      try {
        if (allProgramIds.length > 0) {
          await prisma.studyProgram.deleteMany({ where: { id: { in: allProgramIds } } });
        }
      } catch (error) {
        cleanupErrors.push(`programs: ${String(error)}`);
      }
      try {
        if (allFacultyIds.length > 0) {
          await prisma.faculty.deleteMany({ where: { id: { in: allFacultyIds } } });
        }
      } catch (error) {
        cleanupErrors.push(`faculty: ${String(error)}`);
      }
      try {
        if (fixtureUserIds.length > 0) {
          await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
        }
      } catch (error) {
        cleanupErrors.push(`fixture users: ${String(error)}`);
      }
    };

    const outcome = await runSafeCleanup([safety], cleanup);
    if (!outcome.decision.allowed) {
      console.error(
        JSON.stringify({
          deferredCleanup: true,
          reason: outcome.decision.reason,
          ownershipManifest,
        })
      );
      process.exitCode = 1;
    } else if (cleanupErrors.length > 0) {
      console.error(JSON.stringify({ cleanupErrors, ownershipManifest }));
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify(
          {
            mode: "mixed-source",
            target,
            checks: checks.length,
            batches: batchIds,
            liveEvidence,
            retainedEvidence: "academic_import_batch + academic_import_row_outcome rows retained",
          },
          null,
          1
        )
      );
    }
  }
}

const run = process.argv.includes("--mixed-source") ? runMixedSource : main;
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
