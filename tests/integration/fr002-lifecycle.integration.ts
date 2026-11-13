/**
 * Opt-in FR-002 lifecycle integration harness.
 *
 * Exercises the real Prisma service layer against a real PostgreSQL database and
 * asserts every expected outcome. Ordinary `pnpm test` does not run this file; it
 * runs tests/*.test.ts, which only exercises the pure validation helpers.
 *
 * Usage:
 *   FR002_INTEGRATION=1 pnpm exec tsx tests/integration/fr002-lifecycle.integration.ts --print-target
 *   FR002_INTEGRATION=1 FR002_TARGET_FINGERPRINT=<printed> \
 *     pnpm exec tsx tests/integration/fr002-lifecycle.integration.ts --confirm
 *
 * Add `--skip-http` to run without a dev server. That run is partial: endpoint
 * authorization is reported as skipped, not verified.
 *
 * The harness only creates clearly prefixed fixtures. It deletes fixture courses,
 * programs, and faculties at the end, but retains their audit rows on purpose.
 * Any incorrect outcome, failed preservation, or cleanup failure exits non-zero.
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import { Client } from "pg";
import prisma from "../../src/lib/prisma";
import * as academicService from "../../src/lib/services/academic.service";
import * as courseService from "../../src/lib/services/course.service";
import { enrollMahasiswaCourse } from "../../src/lib/services/mahasiswa.service";
import {
  HarnessValidationError,
  validateCleanup,
  validateEndpoints,
  validateLifecycleScenario,
  validatePreservation,
  type CleanupResult,
  type EndpointResult,
  type Failure,
  type LifecycleExpectation,
  type LockEvidence,
  type OperationOutcome,
  type PreservedAfter,
  type PreservedBefore,
  type Transition,
} from "./fr002-validation";

const PREFIX = "T5R2";
const BASE_URL = process.env.FR002_BASE_URL || "http://localhost:3000";
const SKIP_HTTP = process.argv.includes("--skip-http");

type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

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

if (process.env.FR002_INTEGRATION !== "1" || !process.argv.includes("--confirm")) {
  console.error(
    "Refusing to write fixtures. Set FR002_INTEGRATION=1 and pass --confirm after verifying --print-target."
  );
  process.exit(2);
}
if (process.env.FR002_TARGET_FINGERPRINT !== target.fingerprint) {
  console.error(
    "Target fingerprint mismatch. Expected the value printed by --print-target for THIS database."
  );
  process.exit(2);
}
if (!target.hostMatches || !target.refMatches) {
  console.error("CLI and runtime URLs do not point at the same target. Aborting.");
  process.exit(2);
}

const connection = () => ({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  application_name: "fr002_integration",
});

type Settled<T> = {
  ok: boolean;
  value?: T;
  status?: number;
  message?: string;
};

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    const e = error as { status?: number; message?: string };
    return { ok: false, status: e.status, message: e.message };
  }
}

function observed<T>(settled: Settled<T>): OperationOutcome & { message?: string } {
  const value = settled.ok
    ? (settled.value as { changed?: boolean } | undefined)
    : undefined;
  return {
    ok: settled.ok,
    status: settled.status,
    changed: value?.changed,
    message: settled.message,
  };
}

const createdCourseIds: string[] = [];
const failures: Failure[] = [];
let facultyId: string | null = null;
let programId: string | null = null;
const results: Record<string, unknown> = {
  target: {
    database: target.database,
    schema: target.schema,
    targetFingerprint: target.fingerprint,
  },
  http: SKIP_HTTP ? "skipped" : "checked",
};

function collectScenario(name: string, fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (error) {
    if (!(error instanceof HarnessValidationError)) throw error;
    failures.push(
      ...error.failures.map((failure) => ({
        ...failure,
        check: `${name}: ${failure.check}`,
      }))
    );
    return false;
  }
}

async function main() {
  const blocker = new Client({ ...connection(), application_name: "fr002_blocker" });
  const monitor = new Client({ ...connection(), application_name: "fr002_monitor" });
  await blocker.connect();
  await monitor.connect();
  await blocker.query("SET lock_timeout = '10000ms'");

  async function backendPid(client: Client) {
    const result = await client.query("SELECT pg_backend_pid() AS pid");
    return result.rows[0].pid as number;
  }

  /**
   * Lock waiters reachable from the fixture blocker through pg_blocking_pids.
   * The second waiter may queue behind the first waiter rather than the blocker
   * directly, so the whole blocking chain is walked instead of a database-wide count.
   */
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

  async function waitForChainWaiters(
    blockerPid: number,
    expected: number,
    label: string
  ): Promise<number[]> {
    const deadline = Date.now() + 10000;
    let observedPids = await chainWaiters(blockerPid);
    while (observedPids.length < expected && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      observedPids = await chainWaiters(blockerPid);
    }
    if (observedPids.length < expected) {
      const diagnostics = await monitor
        .query(
          `SELECT pid, pg_blocking_pids(pid) AS blocking, wait_event
             FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock'
              AND query ILIKE '%FOR UPDATE%'
            ORDER BY pid`
        )
        .then((result) => result.rows)
        .catch(() => []);
      throw new Error(
        `${label}: only ${observedPids.length} fixture lock waiter(s) became visible, expected ${expected}` +
          ` (blocker ${blockerPid}; lock waiters ${JSON.stringify(diagnostics)})`
      );
    }
    return observedPids;
  }

  /**
   * Holds the fixture course row lock in the blocker connection, then starts the
   * operations in the requested order. Each operation is only started after the
   * previous one is confirmed queued in the blocker's lock chain, so the observed
   * order is deterministic for this fixture and not a database-wide guess.
   */
  async function runLockedPair<T, U>(
    courseId: string,
    first: () => Promise<T>,
    second: () => Promise<U>
  ) {
    await blocker.query("BEGIN");
    let firstSettled: Promise<Settled<T>> | null = null;
    let secondSettled: Promise<Settled<U>> | null = null;

    try {
      await blocker.query(
        'SELECT "id" FROM public.course WHERE "id" = $1 FOR UPDATE',
        [courseId]
      );
      const blockerPid = await backendPid(blocker);
      const baselineWaiters = await chainWaiters(blockerPid);
      if (baselineWaiters.length !== 0) {
        throw new Error(
          `fixture blocker already has ${baselineWaiters.length} lock waiter(s) before starting`
        );
      }

      const firstPromise = first();
      firstSettled = settle(firstPromise);
      const firstWaiters = await waitForChainWaiters(blockerPid, 1, "first operation");

      const secondPromise = second();
      secondSettled = settle(secondPromise);
      const secondWaiters = await waitForChainWaiters(blockerPid, 2, "second operation");

      await blocker.query("COMMIT");
      const [firstResult, secondResult] = await Promise.all([firstSettled, secondSettled]);

      return {
        first: firstResult,
        second: secondResult,
        lock: {
          blockerPid,
          baselineWaiters,
          firstWaiters,
          secondWaiters,
        } satisfies LockEvidence,
      };
    } catch (error) {
      await blocker.query("ROLLBACK").catch(() => undefined);
      // Drain operations that were started so fixtures are never deleted under them.
      await Promise.allSettled([firstSettled, secondSettled]);
      throw error;
    }
  }

  try {
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    const dosen = await prisma.user.findFirst({ where: { role: "dosen" } });
    const students = await prisma.user.findMany({
      where: { role: "mahasiswa" },
      orderBy: { email: "asc" },
    });
    if (!admin || !dosen || students.length < 2) {
      throw new Error("expected one admin, one dosen, and two mahasiswa accounts");
    }
    const actorId = admin.id;
    const dosenId = dosen.id;

    const stamp = Date.now().toString(36).toUpperCase();
    const faculty = await academicService.createFaculty(`${PREFIX} Faculty ${stamp}`);
    facultyId = faculty.id;
    const program = await academicService.createStudyProgram(
      faculty.id,
      `${PREFIX} Program ${stamp}`
    );
    programId = program.id;

    let counter = 0;
    async function createDraft(label: string) {
      counter += 1;
      const course = await courseService.createCourse(
        {
          title: `${PREFIX} ${label} ${stamp}`,
          courseCode: `R2${stamp.slice(-6)}${counter}`,
          studyProgramId: program.id,
        },
        actorId
      );
      createdCourseIds.push(course.id);
      await courseService.assignInstructor(course.id, dosenId);
      return course;
    }

    async function statusOf(courseId: string) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { catalogStatus: true, isActive: true },
      });
      if (!course) throw new Error(`fixture course ${courseId} disappeared`);
      return course as { catalogStatus: CourseStatus; isActive: boolean };
    }

    async function logsOf(courseId: string): Promise<Transition[]> {
      return prisma.courseCatalogStatusLog.findMany({
        where: { courseId },
        orderBy: { createdAt: "asc" },
        select: { fromStatus: true, toStatus: true, actorId: true, id: true },
      });
    }

    async function instructorsOf(courseId: string) {
      return prisma.courseInstructor.count({ where: { courseId } });
    }

    const publish = (courseId: string) =>
      courseService.setCoursePublication(courseId, "publish", actorId);
    const unpublish = (courseId: string) =>
      courseService.setCoursePublication(courseId, "unpublish", actorId);
    const archive = (courseId: string) => courseService.archiveCourse(courseId, actorId);
    const removeInstructor = (courseId: string) =>
      courseService.removeInstructor(courseId, dosenId);

    async function runScenario(
      name: string,
      label: string,
      first: (courseId: string) => Promise<unknown>,
      second: (courseId: string) => Promise<unknown>,
      expected: LifecycleExpectation
    ) {
      const course = await createDraft(label);
      const pair = await runLockedPair(
        course.id,
        () => first(course.id),
        () => second(course.id)
      );
      const status = await statusOf(course.id);
      const transitions = await logsOf(course.id);
      const instructors = await instructorsOf(course.id);

      const report = {
        first: observed(pair.first),
        second: observed(pair.second),
        waitersObserved: {
          baseline: pair.lock.baselineWaiters,
          first: pair.lock.firstWaiters,
          second: pair.lock.secondWaiters,
        },
        blockerPid: pair.lock.blockerPid,
        finalCatalogStatus: status.catalogStatus,
        instructors,
        transitions: transitions.map((t) => `${t.fromStatus}->${t.toStatus}`),
        auditCount: transitions.length,
        courseId: course.id,
      };
      results[name] = report;

      collectScenario(name, () =>
        validateLifecycleScenario({
          name,
          first: report.first,
          second: report.second,
          finalStatus: status.catalogStatus,
          instructors,
          transitions,
          actorId,
          lock: pair.lock,
          expected,
        })
      );

      return course;
    }

    // A. Publish wins, then archive.
    await runScenario(
      "publishWinsArchive",
      "Ordering Publish First",
      publish,
      archive,
      {
        first: { outcome: "success", changed: true },
        second: { outcome: "success", changed: true },
        finalStatus: "ARCHIVED",
        transitions: [
          { from: "DRAFT", to: "PUBLISHED" },
          { from: "PUBLISHED", to: "ARCHIVED" },
        ],
      }
    );

    // B. Archive wins, publish is rejected.
    await runScenario(
      "archiveWinsPublish",
      "Ordering Archive First",
      archive,
      publish,
      {
        first: { outcome: "success", changed: true },
        second: { outcome: "rejected", status: 409 },
        finalStatus: "ARCHIVED",
        transitions: [{ from: "DRAFT", to: "ARCHIVED" }],
      }
    );

    // C. Publish wins against last-instructor removal.
    await runScenario(
      "publishWinsInstructorRemoval",
      "Ordering Publish Before Removal",
      publish,
      removeInstructor,
      {
        first: { outcome: "success", changed: true },
        second: { outcome: "rejected", status: 409 },
        finalStatus: "PUBLISHED",
        instructors: 1,
        transitions: [{ from: "DRAFT", to: "PUBLISHED" }],
      }
    );

    // D. Removal wins, publish is rejected as incomplete.
    await runScenario(
      "removalWinsPublish",
      "Ordering Removal Before Publish",
      removeInstructor,
      publish,
      {
        first: { outcome: "success" },
        second: { outcome: "rejected", status: 400 },
        finalStatus: "DRAFT",
        instructors: 0,
        transitions: [],
      }
    );

    // E. Populated-data preservation across unpublish.
    {
      const course = await createDraft("Populated Preservation");
      await publish(course.id);

      const session = await prisma.courseSession.create({
        data: {
          id: crypto.randomUUID(),
          courseId: course.id,
          createdBy: dosenId,
          title: `${PREFIX} Session ${stamp}`,
          orderNumber: 1,
        },
      });
      const material = await prisma.material.create({
        data: {
          id: crypto.randomUUID(),
          courseSessionId: session.id,
          uploadedBy: dosenId,
          title: `${PREFIX} Inline Material`,
          materialType: "text",
          fileName: "inline.txt",
          filePath: `text:${PREFIX} inline content`,
          textContent: `${PREFIX} inline content ${stamp}`,
          isProcessed: true,
          processingStatus: "ready",
        },
      });
      const chatSession = await prisma.aiChatSession.create({
        data: {
          id: crypto.randomUUID(),
          userId: students[0].id,
          courseId: course.id,
          courseSessionId: session.id,
          customTitle: `${PREFIX} Chat`,
        },
      });
      const messages = [
        {
          id: crypto.randomUUID(),
          content: `${PREFIX} question ${stamp}`,
          senderType: "user",
        },
        {
          id: crypto.randomUUID(),
          content: `${PREFIX} answer ${stamp}`,
          senderType: "ai",
        },
      ];
      await prisma.aiChatMessage.createMany({
        data: messages.map((message) => ({
          id: message.id,
          aiChatSessionId: chatSession.id,
          senderType: message.senderType,
          content: message.content,
        })),
      });
      await enrollMahasiswaCourse(students[0].id, course.id, course.enrollmentKey);
      const enrollment = await prisma.enrollment.findFirst({
        where: { courseId: course.id, userId: students[0].id },
      });
      if (!enrollment) throw new Error("fixture enrollment was not created");

      const before: PreservedBefore = {
        enrollmentId: enrollment.id,
        sessionId: session.id,
        materialId: material.id,
        materialContent: material.textContent,
        chatSessionId: chatSession.id,
        messages: messages.map((message) => ({
          id: message.id,
          content: message.content,
        })),
      };

      await unpublish(course.id);

      const after: PreservedAfter = {
        enrollment: await prisma.enrollment.findUnique({
          where: { id: before.enrollmentId },
          select: { id: true, isActive: true },
        }),
        session: await prisma.courseSession.findUnique({
          where: { id: before.sessionId },
          select: { id: true },
        }),
        material: await prisma.material.findUnique({
          where: { id: before.materialId },
          select: { id: true, textContent: true },
        }),
        chatSession: await prisma.aiChatSession.findUnique({
          where: { id: before.chatSessionId },
          select: { id: true },
        }),
        messages: await prisma.aiChatMessage.findMany({
          where: { aiChatSessionId: before.chatSessionId },
          orderBy: { createdAt: "asc" },
          select: { id: true, content: true },
        }),
      };

      const databasePreserved = collectScenario("populatedPreservation", () =>
        validatePreservation(before, after)
      );

      const endpoints = await checkEndpoints(course.id, course.enrollmentKey, students);
      const endpointsVerified = collectScenario("populatedPreservation", () =>
        validateEndpoints(endpoints)
      );

      results.populatedPreservation = {
        courseId: course.id,
        databasePreserved,
        endpointsVerified,
        ids: before,
        endpoints,
      };
    }
  } finally {
    try {
      const cleanup = await prisma.$transaction(async (tx) => {
        const deletedCourses = await tx.course.deleteMany({
          where: { id: { in: createdCourseIds } },
        });
        if (programId) await tx.studyProgram.delete({ where: { id: programId } });
        if (facultyId) await tx.faculty.delete({ where: { id: facultyId } });
        return { deletedCourses: deletedCourses.count };
      });

      const remainingFixtureCourses = await prisma.course.count({
        where: { id: { in: createdCourseIds } },
      });
      const retainedAudit = await prisma.courseCatalogStatusLog.groupBy({
        by: ["courseId"],
        where: { courseId: { in: createdCourseIds } },
        _count: { _all: true },
      });

      results.fixtures = {
        facultyId,
        programId,
        courseIds: createdCourseIds,
      };
      results.retainedAudit = retainedAudit.map((row) => ({
        courseId: row.courseId,
        count: row._count._all,
      }));

      const cleanupResult: CleanupResult = {
        ...cleanup,
        expectedCourses: createdCourseIds.length,
        remainingFixtureCourses,
      };
      results.cleanup = cleanupResult;
      collectScenario("cleanup", () => validateCleanup(cleanupResult));
    } catch (error) {
      const cleanupResult: CleanupResult = {
        deletedCourses: -1,
        expectedCourses: createdCourseIds.length,
        remainingFixtureCourses: -1,
        error: error instanceof Error ? error.message : String(error),
      };
      results.cleanup = cleanupResult;
      collectScenario("cleanup", () => validateCleanup(cleanupResult));
    } finally {
      await blocker.end().catch(() => undefined);
      await monitor.end().catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  async function checkEndpoints(
    courseId: string,
    enrollmentKey: string,
    accounts: Array<{ id: string; email: string }>
  ): Promise<EndpointResult> {
    if (SKIP_HTTP) {
      return { status: "skipped", reason: "--skip-http (endpoint authorization unverified)" };
    }

    try {
      const login = async (email: string) => {
        const password = seedPasswordFor(email);
        const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE_URL },
          body: JSON.stringify({ email, password }),
        });
        const cookie = res
          .headers.getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ");
        if (res.status !== 200 || !cookie) {
          throw new Error(`login failed with status ${res.status}`);
        }
        return cookie;
      };

      const studentCookie = await login(accounts[0].email);
      const otherCookie = await login(accounts[1].email);
      const get = async (path: string, cookie: string) => {
        const res = await fetch(BASE_URL + path, {
          headers: { cookie, origin: BASE_URL },
        });
        return { status: res.status, data: await res.json().catch(() => null) };
      };

      const detail = await get(`/api/mahasiswa/courses/${courseId}`, studentCookie);
      const sessions = await get(
        `/api/mahasiswa/courses/${courseId}/sessions`,
        studentCookie
      );
      const available = await get(
        `/api/mahasiswa/courses/available?search=${encodeURIComponent(PREFIX)}`,
        studentCookie
      );
      const otherEnroll = await fetch(`${BASE_URL}/api/mahasiswa/courses/enroll`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE_URL,
          cookie: otherCookie,
        },
        body: JSON.stringify({ courseId, enrollmentKey }),
      });

      return {
        status: "checked",
        existingStudentCourse: detail.status,
        existingStudentSessions: sessions.status,
        discoveryExcludes: Array.isArray(available.data)
          ? !available.data.some((entry: { id: string }) => entry.id === courseId)
          : null,
        otherStudentEnrollStatus: otherEnroll.status,
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "endpoint request failed",
      };
    }
  }

  results.failures = failures;
  console.log(JSON.stringify(results, null, 1));
  if (failures.length > 0) {
    console.error(`FR-002 harness FAILED: ${failures.length} assertion failure(s).`);
    process.exitCode = 1;
  }
}

function seedPasswordFor(email: string) {
  const seed = fs.readFileSync("prisma/seed.ts", "utf8");
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = seed.match(
    new RegExp(`email:\\s*"${escaped}"[^}]*password:\\s*"([^"]+)"`, "si")
  );
  if (!match) throw new Error("development seed password not found");
  return match[1];
}

main().catch((error) => {
  failures.push({
    check: "harness: unexpected failure",
    expected: "all checks completed",
    actual: error instanceof Error ? error.message : String(error),
  });
  results.failures = failures;
  console.log(JSON.stringify(results, null, 1));
  console.error(
    `FR-002 harness FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
