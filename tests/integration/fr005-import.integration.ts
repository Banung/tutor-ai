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
if (process.env.FR005_INTEGRATION !== "1" || !process.argv.includes("--confirm")) {
  console.error("Refusing to write fixtures. Set FR005_INTEGRATION=1 and pass --confirm.");
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

const checks: string[] = [];
function check(name: string, condition: unknown, detail?: unknown): void {
  if (!condition) {
    throw new Error(`check failed: ${name}${detail === undefined ? "" : ` (${JSON.stringify(detail)})`}`);
  }
  checks.push(name);
}

type Json = unknown;
type Api = { status: number; data: Json };

async function request(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown; form?: FormData } = {}
): Promise<Api> {
  const res = await fetch(BASE_URL + path, {
    method: init.method ?? "GET",
    headers: {
      origin: BASE_URL,
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let data: Json = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text.slice(0, 200);
  }
  return { status: res.status, data };
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
): Promise<{ id: string; status: string; summary: Record<string, number>; rows: Array<Record<string, unknown>> }> {
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
  return res.data as never;
}

async function confirm(cookie: string, id: string) {
  return request(`/api/admin/academic-import/${id}/confirm`, { method: "POST", cookie });
}

async function main() {
  const fixtureUserIds: string[] = [];
  const batchIds: string[] = [];

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
  check("program preview counts", spPreview.summary.created === 2 && spPreview.summary.failed === 1, spPreview.summary);
  check("program row numbers preserved", spPreview.rows.map((r) => r.rowNumber).join(",") === "2,3,4");
  check(
    "program preview writes nothing",
    (await prisma.faculty.count({ where: { code: facultyCode } })) === 0 &&
      (await prisma.studyProgram.count({ where: { code: { in: [programA, programB] } } })) === 0
  );

  const spConfirm = await confirm(adminCookie, spPreview.id);
  check("program confirm status", spConfirm.status === 200, spConfirm);
  const spBatch = spConfirm.data as { status: string; createdCount: number; failedCount: number };
  check("program partial result", spBatch.status === "PARTIAL" && spBatch.createdCount === 2 && spBatch.failedCount === 1, spBatch);
  const faculty = await prisma.faculty.findUnique({ where: { code: facultyCode } });
  const programs = await prisma.studyProgram.findMany({ where: { code: { in: [programA, programB] } } });
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
  check("course preview counts", coursePreview.summary.created === 2 && coursePreview.summary.failed === 2, coursePreview.summary);
  check("course preview writes nothing", (await prisma.academicCourseReference.count()) === 0);

  const courseConfirm = await confirm(adminCookie, coursePreview.id);
  const courseBatch = courseConfirm.data as { status: string; createdCount: number; failedCount: number };
  check("course partial commit", courseBatch.status === "PARTIAL" && courseBatch.createdCount === 2 && courseBatch.failedCount === 2, courseBatch);
  check("course references persist", (await prisma.academicCourseReference.count()) === 2);
  check("catalog Course untouched", (await prisma.course.count()) === catalogCoursesBefore);

  const rePreview = await preview(adminCookie, "PIPP", "COURSES", "h7-courses.csv", courseHeaders, courseRows);
  batchIds.push(rePreview.id);
  check("re-import classifies unchanged", rePreview.summary.updated === 0 && rePreview.summary.unchanged === 2, rePreview.summary);
  const reConfirm = await confirm(adminCookie, rePreview.id);
  const reBatch = reConfirm.data as { createdCount: number; unchangedCount: number };
  check("re-import creates no duplicates", reBatch.createdCount === 0 && reBatch.unchangedCount === 2, reBatch);
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
  check("PIPP-owned course may be superseded by SIAT", siatUpdateA.summary.updated === 1, siatUpdateA.summary);
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
  check("PIPP cannot overwrite SIAT-owned course", pippOverwriteA.summary.conflict === 1, pippOverwriteA.summary);
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
  const staleBatch = staleConfirm.data as { status: string; outcomes: Array<{ message: string | null }> };
  check(
    "stale preview marked failed",
    staleBatch.status === "PARTIAL" &&
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
  check("lecturer preview counts", lecturerPreview.summary.created === 1 && lecturerPreview.summary.failed === 1, lecturerPreview.summary);
  check("lecturer preview creates no auth rows", (await prisma.user.count()) === usersBefore && (await prisma.account.count()) === accountsBefore);
  const lecturerConfirm = await confirm(adminCookie, lecturerPreview.id);
  check("lecturer confirm partial", (lecturerConfirm.data as { status: string }).status === "PARTIAL");
  const lecturer = await prisma.lecturerReference.findFirst({ where: { nip: lecturerNip } });
  check("lecturer reference keeps leading zeros", lecturer?.nip === lecturerNip, lecturer?.nip);
  check("lecturer import creates no user", (await prisma.user.count()) === usersBefore);
  check(
    "lecturer import creates no user with identifiers",
    (await prisma.user.count({ where: { OR: [{ nip: lecturerNip }, { nidn: lecturerNidn }] } })) === 0
  );
  const lecturerRe = await preview(adminCookie, "SIAT", "LECTURERS", "h7-lecturers.csv", lecturerHeaders, lecturerRows);
  batchIds.push(lecturerRe.id);
  check("lecturer re-import unchanged", lecturerRe.summary.unchanged === 1 && lecturerRe.summary.created === 0, lecturerRe.summary);
  await confirm(adminCookie, lecturerRe.id);
  check("lecturer no duplicate", (await prisma.lecturerReference.count({ where: { nip: lecturerNip } })) === 1);

  console.log(
    JSON.stringify(
      {
        target,
        checks: checks.length,
        batches: batchIds,
        retainedEvidence: "academic_import_batch + academic_import_row_outcome rows retained",
      },
      null,
      1
    )
  );
} finally {
  const cleanupErrors: string[] = [];
  try {
    await prisma.academicCourseReference.deleteMany({ where: { courseCode: { in: [courseA, courseB] } } });
  } catch (error) {
    cleanupErrors.push(`course refs: ${String(error)}`);
  }
  try {
    await prisma.lecturerReference.deleteMany({ where: { nip: lecturerNip } });
  } catch (error) {
    cleanupErrors.push(`lecturer refs: ${String(error)}`);
  }
  try {
    await prisma.studyProgram.deleteMany({ where: { code: { in: [programA, programB] } } });
  } catch (error) {
    cleanupErrors.push(`programs: ${String(error)}`);
  }
  try {
    await prisma.faculty.deleteMany({ where: { code: facultyCode } });
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
  if (cleanupErrors.length > 0) {
    console.error(JSON.stringify({ cleanupErrors, retainedBatchIds: batchIds }));
    process.exitCode = 1;
  }
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
