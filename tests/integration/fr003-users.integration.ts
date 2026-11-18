/**
 * Opt-in FR-003 live integration harness.
 *
 * Exercises the real admin APIs, Better Auth public endpoints, and the real
 * PostgreSQL-backed services. Ordinary `pnpm test` does not run this file.
 *
 * Usage:
 *   FR003_INTEGRATION=1 pnpm exec tsx tests/integration/fr003-users.integration.ts --print-target
 *   FR003_INTEGRATION=1 FR003_TARGET_FINGERPRINT=<printed> \
 *     pnpm exec tsx tests/integration/fr003-users.integration.ts --confirm
 *
 * Endpoint checks are mandatory; there is no skip/omission mode. Incorrect
 * results, cleanup errors, or lock timeouts exit non-zero.
 *
 * Fixtures are T6-prefixed users, courses, and academic references. Cleanup
 * removes them but retains user_role_audit rows on purpose.
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import { Client } from "pg";
import prisma from "../../src/lib/prisma";
import * as academicService from "../../src/lib/services/academic.service";
import * as courseService from "../../src/lib/services/course.service";
import * as userService from "../../src/lib/services/user.service";
import {
  cleanupFailureMessage,
  LockPairError,
  runLockedPairSafely,
  runSafeCleanup,
  validateWaiters,
  type PairSafety,
} from "./fr003-validation";

const BASE_URL = process.env.FR003_BASE_URL || "http://localhost:3000";
const PREFIX = "T6";
const PASSWORD = "T6HarnessPass!2026";
// Lock-observation operations block behind an external fixture transaction, so
// Prisma's 5s interactive default is too short for the harness measurement.
const TX_TIMEOUT_MS = 15000;

function parseTarget() {
  const direct = process.env.DIRECT_URL;
  const runtime = process.env.DATABASE_URL;
  if (!direct || !runtime) throw new Error("DIRECT_URL and DATABASE_URL are required");

  const d = new URL(direct);
  const r = new URL(runtime);
  const refOf = (u: URL) => (u.username.match(/^postgres\.(.+)$/) || [])[1] ?? "";
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${refOf(d)}|${d.hostname.toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);

  return {
    database: d.pathname.replace(/^\//, "") || "(default)",
    schema: "public",
    fingerprint,
    hostMatches: d.hostname.toLowerCase() === r.hostname.toLowerCase(),
    refMatches: refOf(d) === refOf(r),
  };
}

const target = parseTarget();

if (process.argv.includes("--print-target")) {
  console.log(
    JSON.stringify(
      {
        database: target.database,
        schema: target.schema,
        targetFingerprint: target.fingerprint,
        cliAndRuntimeSameTarget: target.hostMatches && target.refMatches,
      },
      null,
      1
    )
  );
  process.exit(0);
}

if (process.env.FR003_INTEGRATION !== "1" || !process.argv.includes("--confirm")) {
  console.error(
    "Refusing to write fixtures. Set FR003_INTEGRATION=1 and pass --confirm after verifying --print-target."
  );
  process.exit(2);
}
if (process.env.FR003_TARGET_FINGERPRINT !== target.fingerprint) {
  console.error(
    "Target fingerprint mismatch. Expected the value printed by --print-target for THIS database."
  );
  process.exit(2);
}
if (!target.hostMatches || !target.refMatches) {
  console.error("CLI and runtime URLs do not point at the same target. Aborting.");
  process.exit(2);
}

type Json = unknown;

type ApiResult = { status: number; data: Json };

const stamp = Date.now().toString(36);
const emailPrefix = `t6.${stamp}.`;
const email = (label: string) => `${emailPrefix}${label}@harness.test`;

const checks: Array<{ name: string; detail?: unknown }> = [];
let cleanupFailure: string | null = null;
let cleanupDeferred = false;
let httpUncertain = false;
let baselineUsers = -1;
const results: Record<string, unknown> = {
  target: {
    database: target.database,
    schema: target.schema,
    targetFingerprint: target.fingerprint,
  },
};
const createdUserIds: string[] = [];
const createdCourseIds: string[] = [];
const createdProgramIds: string[] = [];
const createdFacultyIds: string[] = [];

function check(name: string, condition: unknown, detail?: unknown): void {
  if (!condition) {
    throw new Error(
      `check failed: ${name}${detail === undefined ? "" : ` (${JSON.stringify(detail)})`}`
    );
  }
  checks.push({ name, ...(detail === undefined ? {} : { detail }) });
}

async function guardedFetch(input: string, init: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    // An abort/timeout means we no longer know whether the server finished.
    httpUncertain = true;
    throw error;
  }
}

async function request(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {}
): Promise<ApiResult> {
  const res = await guardedFetch(BASE_URL + path, {
    method: init.method ?? "GET",
    headers: {
      origin: BASE_URL,
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
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

async function login(emailAddress: string, password = PASSWORD): Promise<string> {
  const res = await guardedFetch(BASE_URL + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email: emailAddress, password }),
    signal: AbortSignal.timeout(15000),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (res.status !== 200 || !cookie) {
    throw new Error(`login failed with status ${res.status}`);
  }
  return cookie;
}

function seedPasswordFor(emailAddress: string): string {
  const seed = fs.readFileSync("prisma/seed.ts", "utf8");
  const escaped = emailAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = seed.match(
    new RegExp(`email:\\s*"${escaped}"[^}]*password:\\s*"([^"]+)"`, "si")
  );
  if (!match) throw new Error("development seed password not found for the bootstrap admin");
  return match[1];
}

function observed<T>(settled: PromiseSettledResult<T>) {
  if (settled.status === "fulfilled") return { ok: true, value: settled.value };
  const reason = settled.reason as { status?: number; message?: string };
  return { ok: false, status: reason?.status, message: reason?.message };
}

async function main() {
  const blocker = new Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    application_name: "fr003_blocker",
  });
  const monitor = new Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    application_name: "fr003_monitor",
  });
  const admin = new Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    application_name: "fr003_admin",
  });
  await blocker.connect();
  await monitor.connect();
  await admin.connect();
  await blocker.query("SET lock_timeout = '10000ms'");

  async function backendPid(client: Client) {
    return (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number;
  }

  async function chainWaiters(blockerPid: number): Promise<number[]> {
    const result = await monitor.query(
      `WITH RECURSIVE chain(pid) AS (
         SELECT $1::int
         UNION
         SELECT blocked.pid
           FROM pg_stat_activity blocked
           JOIN chain ON chain.pid = ANY(pg_blocking_pids(blocked.pid))
          WHERE blocked.datname = current_database()
            AND blocked.pid <> pg_backend_pid()
       )
       SELECT activity.pid
         FROM pg_stat_activity activity
         JOIN chain ON chain.pid = activity.pid
        WHERE activity.pid <> $1
          AND activity.state = 'active'
          AND activity.wait_event_type = 'Lock'
          AND activity.query ILIKE '%FOR UPDATE%'
        ORDER BY activity.pid`,
      [blockerPid]
    );
    return result.rows.map((row) => row.pid as number);
  }

  async function waitForWaiters(blockerPid: number, expected: number, label: string) {
    const deadline = Date.now() + 10000;
    let pids = await chainWaiters(blockerPid);
    while (pids.length < expected && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      pids = await chainWaiters(blockerPid);
    }
    if (pids.length !== expected) {
      throw new Error(
        `${label}: saw ${pids.length} fixture lock waiter(s), expected exactly ${expected}`
      );
    }
    if (new Set(pids).size !== pids.length) {
      throw new Error(`${label}: duplicate waiter PIDs ${JSON.stringify(pids)}`);
    }
    return pids;
  }

  async function runLockedPair<T, U>(
    lockSql: string,
    params: unknown[],
    first: () => Promise<T>,
    second: () => Promise<U>
  ) {
    // Baseline and blocker pid are captured before the lock is taken, keeping
    // the fixture transaction short enough for Prisma's 5s interactive budget.
    const blockerPid = await backendPid(blocker);
    const baseline = await chainWaiters(blockerPid);
    check("lock baseline is empty", baseline.length === 0, baseline);

    try {
      const result = await runLockedPairSafely({
        begin: async () => {
          await blocker.query("BEGIN");
          await blocker.query(lockSql, params);
        },
        release: async () => {
          await blocker.query("COMMIT");
        },
        rollback: async () => {
          await blocker.query("ROLLBACK");
        },
        first,
        second,
        waitFirst: () => waitForWaiters(blockerPid, 1, "first operation"),
        waitSecond: () => waitForWaiters(blockerPid, 2, "second operation"),
        validate: validateWaiters,
        settleTimeoutMs: 15000,
      });
      pairSafeties.push(result.safety);
      return {
        first: observed(result.first),
        second: observed(result.second),
        waiters: { baseline, ...result.waiters },
      };
    } catch (error) {
      // Preserve the safety outcome even when the pair throws; the outer
      // finally must not delete fixtures while settlement is uncertain.
      if (error instanceof LockPairError) pairSafeties.push(error.safety);
      throw error;
    }
  }


  const pairSafeties: PairSafety[] = [];

  try {
    const seededAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    check("a bootstrap admin exists", Boolean(seededAdmin));
    baselineUsers = await prisma.user.count();
    const bootstrapCookie = await login(
      seededAdmin!.email,
      seedPasswordFor(seededAdmin!.email)
    );

    const adminApi = (cookie: string) => ({
      get: (path: string) => request(path, { cookie }),
      post: (path: string, body: unknown) => request(path, { method: "POST", cookie, body }),
      patch: (path: string, body: unknown) => request(path, { method: "PATCH", cookie, body }),
      delete: (path: string) => request(path, { method: "DELETE", cookie }),
    });

    const asBootstrap = adminApi(bootstrapCookie);

    async function createFixtureUser(params: {
      label: string;
      role: string;
      npm?: string | null;
      nip?: string | null;
      nidn?: string | null;
      academicLevel?: string | null;
    }) {
      const emailAddress = email(params.label);
      const res = await asBootstrap.post("/api/admin/users", {
        name: `${PREFIX} ${params.label}`,
        email: emailAddress,
        password: PASSWORD,
        role: params.role,
        ...(params.npm !== undefined ? { npm: params.npm } : {}),
        ...(params.nip !== undefined ? { nip: params.nip } : {}),
        ...(params.nidn !== undefined ? { nidn: params.nidn } : {}),
        ...(params.academicLevel !== undefined
          ? { academicLevel: params.academicLevel }
          : {}),
      });
      if (res.status !== 201) {
        throw new Error(`create fixture ${params.label} failed: ${res.status}`);
      }
      const user = res.data as { id: string; role: string; nip?: string | null; nidn?: string | null; npm?: string | null };
      createdUserIds.push(user.id);
      return { user, email: emailAddress };
    }

    // --- Identifier persistence, validation, and search ---
    const dosenA = await createFixtureUser({
      label: "dosen-a",
      role: "dosen",
      nip: " 0012345678 ",
    });
    check("NIP persists trimmed with leading zeros", dosenA.user.nip === "0012345678", dosenA.user.nip);

    const dosenB = await createFixtureUser({
      label: "dosen-b",
      role: "dosen",
      nidn: "9876543210",
    });
    check("NIDN persists", dosenB.user.nidn === "9876543210", dosenB.user.nidn);

    const dosenBlank = await createFixtureUser({
      label: "dosen-blank",
      role: "dosen",
      nip: "   ",
    });
    const blankDetail = await asBootstrap.get(`/api/admin/users/${dosenBlank.user.id}`);
    check(
      "blank optional NIP is normalized to null",
      blankDetail.status === 200 && (blankDetail.data as { nip?: unknown }).nip === null
    );

    const student = await createFixtureUser({
      label: "student",
      role: "mahasiswa",
      npm: "0011223344",
      academicLevel: "S1",
    });
    check("NPM persists", student.user.npm === "0011223344", student.user.npm);

    const invalidSeven = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} invalid-seven`,
      email: email("invalid-seven"),
      password: PASSWORD,
      role: "mahasiswa",
      npm: "1234567",
      academicLevel: "S1",
    });
    check("7-digit NPM is rejected", invalidSeven.status === 400, invalidSeven.status);

    const invalidNineteen = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} invalid-nineteen`,
      email: email("invalid-nineteen"),
      password: PASSWORD,
      role: "mahasiswa",
      npm: "1234567890123456789",
      academicLevel: "S1",
    });
    check("19-digit NPM is rejected", invalidNineteen.status === 400, invalidNineteen.status);

    const invalidAlpha = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} invalid-alpha`,
      email: email("invalid-alpha"),
      password: PASSWORD,
      role: "dosen",
      nip: "1234abcd",
    });
    check("non-digit NIP is rejected", invalidAlpha.status === 400, invalidAlpha.status);

    const duplicateNip = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} duplicate-nip`,
      email: email("duplicate-nip"),
      password: PASSWORD,
      role: "dosen",
      nip: "0012345678",
    });
    check("duplicate NIP is a controlled 409", duplicateNip.status === 409, duplicateNip.status);
    const duplicateBody = duplicateNip.data as Record<string, unknown>;
    check(
      "duplicate NIP is a pre-creation failure, not partial",
      duplicateBody.partial !== true && duplicateBody.userId === undefined,
      duplicateBody
    );
    const duplicateAccount = await prisma.user.findUnique({
      where: { email: email("duplicate-nip") },
      select: { id: true },
    });
    check(
      "duplicate NIP created no account",
      duplicateAccount === null,
      duplicateAccount
    );

    const adminWithNip = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} admin-with-nip`,
      email: email("admin-with-nip"),
      password: PASSWORD,
      role: "admin",
      nip: "55556666",
    });
    check("admin with NIP is rejected", adminWithNip.status === 400, adminWithNip.status);

    const badRole = await asBootstrap.post("/api/admin/users", {
      name: `${PREFIX} bad-role`,
      email: email("bad-role"),
      password: PASSWORD,
      role: "superadmin",
    });
    check("invalid role is rejected", badRole.status === 400, badRole.status);

    for (const [term, expectedId, label] of [
      ["0012345678", dosenA.user.id, "search by NIP"],
      ["9876543210", dosenB.user.id, "search by NIDN"],
      ["0011223344", student.user.id, "search by NPM"],
      ["dosen-a", dosenA.user.id, "search by name"],
      [emailPrefix + "student@", student.user.id, "search by email fragment"],
    ] as const) {
      const res = await asBootstrap.get(
        `/api/admin/users?search=${encodeURIComponent(term)}`
      );
      const found = Array.isArray(res.data)
        ? res.data.some((entry: { id: string }) => entry.id === expectedId)
        : false;
      check(label, res.status === 200 && found, { status: res.status, found });
    }

    // --- Admin mutations: auth, self protection, audit ---
    const anonymousCreate = await request("/api/admin/users", {
      method: "POST",
      body: { name: "x", email: email("anon"), password: PASSWORD, role: "mahasiswa" },
    });
    check("anonymous user creation is 401", anonymousCreate.status === 401, anonymousCreate.status);

    const studentCookie = await login(student.email);
    const asStudent = adminApi(studentCookie);
    const studentCreate = await asStudent.post("/api/admin/users", {
      name: "x",
      email: email("student-made"),
      password: PASSWORD,
      role: "mahasiswa",
    });
    check("non-admin user creation is 403", studentCreate.status === 403, studentCreate.status);

    const adminA = await createFixtureUser({ label: "admin-a", role: "admin" });
    const adminB = await createFixtureUser({ label: "admin-b", role: "admin" });
    const cookieA = await login(adminA.email);
    const cookieB = await login(adminB.email);
    const asAdminA = adminApi(cookieA);

    const selfRole = await asAdminA.patch(`/api/admin/users/${adminA.user.id}`, {
      role: "dosen",
      nip: "11223344",
    });
    check("self role change is rejected", selfRole.status === 403, selfRole.status);

    const selfRename = await asAdminA.patch(`/api/admin/users/${adminA.user.id}`, {
      name: `${PREFIX} Admin A Renamed`,
    });
    check("own profile edit with unchanged role is allowed", selfRename.status === 200, selfRename.status);

    const selfDelete = await asAdminA.delete(`/api/admin/users/${adminA.user.id}`);
    check("self deletion is rejected", selfDelete.status === 403, selfDelete.status);

    const forgedActor = await asAdminA.patch(`/api/admin/users/${student.user.id}`, {
      name: "forged",
      actorId: "forged",
    });
    check("forged actor field is rejected", forgedActor.status === 400, forgedActor.status);

    const auditCount = async (userId: string) =>
      prisma.userRoleAudit.count({ where: { userId } });

    const beforePromotion = await auditCount(student.user.id);
    const promote = await asAdminA.patch(`/api/admin/users/${student.user.id}`, {
      role: "dosen",
      nip: "77889900",
    });
    check("role change succeeds", promote.status === 200, promote.status);
    check(
      "role change clears incompatible NPM/academic level",
      (promote.data as { npm?: unknown; academicLevel?: unknown }).npm === null &&
        (promote.data as { academicLevel?: unknown }).academicLevel === null
    );
    check(
      "role change writes exactly one audit row",
      (await auditCount(student.user.id)) === beforePromotion + 1
    );

    const auditRow = await prisma.userRoleAudit.findFirst({
      where: { userId: student.user.id },
      orderBy: { createdAt: "desc" },
    });
    check(
      "audit row records actor and transition",
      auditRow?.actorId === adminA.user.id &&
        auditRow?.fromRole === "mahasiswa" &&
        auditRow?.toRole === "dosen",
      auditRow
    );

    const sameRoleSave = await asAdminA.patch(`/api/admin/users/${student.user.id}`, {
      name: `${PREFIX} Student Renamed`,
    });
    check("same-role save succeeds", sameRoleSave.status === 200, sameRoleSave.status);
    check(
      "same-role save writes no transition",
      (await auditCount(student.user.id)) === beforePromotion + 1
    );

    const demoteBack = await asAdminA.patch(`/api/admin/users/${student.user.id}`, {
      role: "mahasiswa",
      npm: "0011223344",
      academicLevel: "S2",
    });
    check("role change back to mahasiswa succeeds", demoteBack.status === 200, demoteBack.status);
    check(
      "second transition adds one audit row",
      (await auditCount(student.user.id)) === beforePromotion + 2
    );

    // --- Fresh login permissions ---
    const freshStudentCookie = await login(student.email);
    const freshAsDosen = await request("/api/dosen/courses", { cookie: freshStudentCookie });
    check("demoted user loses dosen access on fresh login", freshAsDosen.status === 403, freshAsDosen.status);
    const freshAsMahasiswa = await request("/api/mahasiswa/courses", { cookie: freshStudentCookie });
    check("demoted user has mahasiswa access on fresh login", freshAsMahasiswa.status === 200, freshAsMahasiswa.status);

    // --- Public Better Auth role escalation attempts ---
    const forgedSignupEmail = email("forged-signup");
    const forgedSignup = await request("/api/auth/sign-up/email", {
      method: "POST",
      body: {
        name: `${PREFIX} Forged Signup`,
        email: forgedSignupEmail,
        password: PASSWORD,
        role: "admin",
      },
    });
    check(
      "public signup with role does not create an admin",
      forgedSignup.status === 400 || forgedSignup.status === 200,
      forgedSignup.status
    );
    const forgedSignupUser = await prisma.user.findUnique({
      where: { email: forgedSignupEmail },
      select: { id: true, role: true },
    });
    if (forgedSignupUser) createdUserIds.push(forgedSignupUser.id);
    check(
      "public signup cannot set an elevated role",
      !forgedSignupUser || forgedSignupUser.role === "mahasiswa",
      forgedSignupUser
    );

    const profileEscalation = await request("/api/auth/update-user", {
      method: "POST",
      cookie: freshStudentCookie,
      body: { role: "admin" },
    });
    check(
      "public profile update cannot set role",
      profileEscalation.status === 400,
      profileEscalation.status
    );
    const studentRoleAfter = await prisma.user.findUnique({
      where: { id: student.user.id },
      select: { role: true },
    });
    check("public profile update left role unchanged", studentRoleAfter?.role === "mahasiswa");

    const ordinaryProfileUpdate = await request("/api/auth/update-user", {
      method: "POST",
      cookie: freshStudentCookie,
      body: { name: `${PREFIX} Ordinary Update` },
    });
    check("ordinary profile update still works", ordinaryProfileUpdate.status === 200, ordinaryProfileUpdate.status);

    // --- Assignment versus demotion, both orderings ---
    const faculty = await academicService.createFaculty(`${PREFIX} Faculty ${stamp}`);
    createdFacultyIds.push(faculty.id);
    const program = await academicService.createStudyProgram(
      faculty.id,
      `${PREFIX} Program ${stamp}`
    );
    createdProgramIds.push(program.id);

    async function createCourseFixture(label: string) {
      const course = await courseService.createCourse(
        {
          title: `${PREFIX} ${label} ${stamp}`,
          courseCode: `T6${stamp.slice(-5).toUpperCase()}${createdCourseIds.length + 1}`,
          studyProgramId: program.id,
        },
        seededAdmin!.id
      );
      createdCourseIds.push(course.id);
      return course;
    }

    // Warm the Prisma pool so interactive transactions are not charged for
    // cold connection setup while the fixture blocker is held.
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);

    const assignDosen = await createFixtureUser({
      label: "assign-dosen",
      role: "dosen",
      nip: "31313131",
    });
    const assignCourse = await createCourseFixture("Assignment First");
    const assignmentFirst = await runLockedPair(
      'SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE',
      [assignDosen.user.id],
      () =>
        courseService.assignInstructor(
          assignCourse.id,
          assignDosen.user.id,
          TX_TIMEOUT_MS
        ),
      () =>
        userService.updateUser(
          assignDosen.user.id,
          { role: "mahasiswa", npm: "0011998877", academicLevel: "S1" },
          seededAdmin!.id,
          TX_TIMEOUT_MS
        )
    );
    check("assignment-first: assignment succeeds", assignmentFirst.first.ok, assignmentFirst.first);
    check(
      "assignment-first: demotion is rejected with 409",
      !assignmentFirst.second.ok && assignmentFirst.second.status === 409,
      assignmentFirst.second
    );
    check(
      "assignment-first: assignment is retained",
      (await prisma.courseInstructor.count({ where: { userId: assignDosen.user.id } })) === 1
    );
    check(
      "assignment-first: role is unchanged",
      (await prisma.user.findUnique({ where: { id: assignDosen.user.id }, select: { role: true } }))?.role === "dosen"
    );

    const demoteDosen = await createFixtureUser({
      label: "demote-dosen",
      role: "dosen",
      nip: "32323232",
    });
    const demoteCourse = await createCourseFixture("Demotion First");
    const demotionFirst = await runLockedPair(
      'SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE',
      [demoteDosen.user.id],
      () =>
        userService.updateUser(
          demoteDosen.user.id,
          { role: "mahasiswa", npm: "0011887766", academicLevel: "S1" },
          seededAdmin!.id,
          TX_TIMEOUT_MS
        ),
      () =>
        courseService.assignInstructor(
          demoteCourse.id,
          demoteDosen.user.id,
          TX_TIMEOUT_MS
        )
    );
    check("demotion-first: demotion succeeds", demotionFirst.first.ok, demotionFirst.first);
    check(
      "demotion-first: assignment is rejected with 400",
      !demotionFirst.second.ok && demotionFirst.second.status === 400,
      demotionFirst.second
    );
    check(
      "demotion-first: no assignment is created",
      (await prisma.courseInstructor.count({ where: { userId: demoteDosen.user.id } })) === 0
    );

    results.lockEvidence = {
      assignmentFirst: assignmentFirst.waiters,
      demotionFirst: demotionFirst.waiters,
    };

    // --- Concurrent reciprocal admin changes ---
    const adminAAudits = await auditCount(adminA.user.id);
    const adminBAudits = await auditCount(adminB.user.id);
    const [raceA, raceB] = await Promise.all([
      adminApi(cookieA).patch(`/api/admin/users/${adminB.user.id}`, {
        role: "mahasiswa",
        npm: "0011445566",
        academicLevel: "S1",
      }),
      adminApi(cookieB).patch(`/api/admin/users/${adminA.user.id}`, {
        role: "mahasiswa",
        npm: "0011445577",
        academicLevel: "S1",
      }),
    ]);
    const statuses = [raceA.status, raceB.status].sort((a, b) => a - b);
    check("reciprocal admin race yields one success and one 403", statuses[0] === 200 && statuses[1] === 403, statuses);
    const rolesAfterRace = await prisma.user.findMany({
      where: { id: { in: [adminA.user.id, adminB.user.id] } },
      select: { id: true, role: true },
    });
    check(
      "reciprocal admin race leaves exactly one admin",
      rolesAfterRace.filter((row) => row.role === "admin").length === 1,
      rolesAfterRace
    );
    const demotedAdminId =
      rolesAfterRace.find((row) => row.role === "mahasiswa")?.id ?? "";
    const remainingAuditDelta =
      (await auditCount(adminA.user.id)) - adminAAudits + ((await auditCount(adminB.user.id)) - adminBAudits);
    check("reciprocal admin race writes one audit row", remainingAuditDelta === 1, remainingAuditDelta);
    check("demoted admin is recorded", Boolean(demotedAdminId));

    // --- Creation finalization revalidates the actor inside the transaction ---
    const createActor = await createFixtureUser({
      label: "create-actor",
      role: "admin",
    });
    const demoter = await createFixtureUser({
      label: "create-demoter",
      role: "admin",
    });
    const orphanEmail = email("orphan-target");
    const actorRevalidation = await runLockedPair(
      'SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE',
      [createActor.user.id],
      () =>
        userService.updateUser(
          createActor.user.id,
          { role: "mahasiswa", npm: "0011334455", academicLevel: "S1" },
          demoter.user.id,
          TX_TIMEOUT_MS
        ),
      () =>
        userService.createUser(
          {
            name: `${PREFIX} Orphan Target`,
            email: orphanEmail,
            password: PASSWORD,
            role: "dosen",
            nip: "55667788",
          },
          createActor.user.id,
          TX_TIMEOUT_MS
        )
    );
    check(
      "creation actor revalidation: demotion commits first",
      actorRevalidation.first.ok,
      actorRevalidation.first
    );
    check(
      "creation actor revalidation: revoked actor is rejected with 403",
      !actorRevalidation.second.ok && actorRevalidation.second.status === 403,
      actorRevalidation.second
    );
    const orphan = await prisma.user.findUnique({
      where: { email: orphanEmail },
      select: { id: true, role: true, nip: true, nidn: true },
    });
    if (orphan) createdUserIds.push(orphan.id);
    check(
      "revoked actor leaves the retained account in the default mahasiswa state",
      orphan?.role === "mahasiswa" && orphan?.nip === null && orphan?.nidn === null,
      orphan
    );
    check(
      "revoked actor finalizes no elevated role and no audit row",
      orphan
        ? (await prisma.userRoleAudit.count({ where: { userId: orphan.id } })) === 0
        : false
    );
    results.actorRevalidation = actorRevalidation.waiters;

    // Live audit fault injection is intentionally omitted: this revision does
    // not authorize trigger/function DDL. The DB-free tests cover rollback.
    results.liveFaultInjection = "NOT RUN (no trigger/function DDL authorized)";

    results.fixtures = {
      userIds: createdUserIds,
      courseIds: createdCourseIds,
      programIds: createdProgramIds,
      facultyIds: createdFacultyIds,
    };
  } finally {
    results.pairSafety = pairSafeties;
    const safetyForCleanup: PairSafety[] = httpUncertain
      ? [
          ...pairSafeties,
          {
            blockerReleased: false,
            releaseUncertain: true,
            operationsSettled: false,
            failures: [
              "an HTTP request did not complete confirmation; server-side completion is unknown",
            ],
            cleanupSafe: false,
          },
        ]
      : pairSafeties;

    let cleanupError: string | undefined;
    const cleanupOutcome = await runSafeCleanup(safetyForCleanup, async () => {
      try {
        await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
        await prisma.studyProgram.deleteMany({ where: { id: { in: createdProgramIds } } });
        await prisma.faculty.deleteMany({ where: { id: { in: createdFacultyIds } } });
        await prisma.user.deleteMany({
          where: { email: { startsWith: emailPrefix } },
        });
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }
    });

    if (!cleanupOutcome.ran) {
      // At least one started operation may still be running, or the blocker
      // outcome is unknown. Deleting fixtures here could race those operations.
      cleanupDeferred = true;
      results.cleanup = {
        deferred: true,
        reason: cleanupOutcome.decision.allowed
          ? "cleanup was not run"
          : cleanupOutcome.decision.reason,
        manifest: {
          emailPrefix,
          userIds: [...createdUserIds],
          courseIds: [...createdCourseIds],
          programIds: [...createdProgramIds],
          facultyIds: [...createdFacultyIds],
        },
      };
      cleanupFailure = `fixture deletion deferred: ${
        cleanupOutcome.decision.allowed
          ? "cleanup was not run"
          : cleanupOutcome.decision.reason
      }`;
    } else {
      const remainingFixtures = await prisma.user.count({
        where: { email: { startsWith: emailPrefix } },
      });
      const usersAfterCleanup = await prisma.user.count();
      const retainedAudit = createdUserIds.length
        ? await prisma.userRoleAudit.groupBy({
            by: ["userId"],
            where: { userId: { in: createdUserIds } },
            _count: { _all: true },
          })
        : [];

      results.cleanup = {
        remainingFixtures,
        error: cleanupError ?? null,
        retainedAudit: retainedAudit.map((row) => ({
          userId: row.userId,
          count: row._count._all,
        })),
      };
      results.preservedUsers = { baseline: baselineUsers, after: usersAfterCleanup };
      cleanupFailure = cleanupFailureMessage({
        remainingFixtures,
        error: cleanupError ?? null,
        baselineUsers,
        usersAfterCleanup,
      });

      await blocker.end().catch(() => undefined);
      await monitor.end().catch(() => undefined);
      await admin.end().catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  results.checks = checks;
  results.passed = checks.length;
  if (cleanupFailure) throw new Error(cleanupFailure);
  console.log(JSON.stringify(results, null, 1));
}

main().catch((error) => {
  results.checks = checks;
  results.passed = checks.length;
  results.status = "FAILED";
  results.message = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify(results, null, 1));
  console.error(
    `FR-003 harness FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
  if (cleanupDeferred) {
    // Operations may still hold the Prisma pool; leave fixtures in place and
    // terminate instead of risking deletion while work is in flight.
    process.exit(1);
  }
});
