import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  INVALID_DATE_RANGE_MESSAGE,
  statsExportQuerySchema,
  statsFilterSchema,
} from "../src/lib/schemas/stats.schema";
import {
  generateGlobalReportCsv,
  generateGlobalReportPdf,
  getGlobalDashboardStats,
  INACTIVE_COURSE_THRESHOLD_DAYS,
} from "../src/lib/services/stats.service";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/tutor_ai_test";

type AnyFn = (...args: any[]) => any;

function replaceMethod(target: object, name: string, impl: AnyFn) {
  const record = target as Record<string, unknown>;
  const original = record[name];
  record[name] = impl;
  return () => {
    record[name] = original;
  };
}

type CourseRow = {
  id: string;
  title: string;
  courseCode: string | null;
  isActive: boolean;
  catalogStatus: string;
  studyProgram: {
    id: string;
    name: string;
    faculty: { name: string } | null;
  } | null;
  _count: { enrollments: number };
};

type EnrollmentRow = { courseId: string; enrolledAt: Date };
type SessionRow = {
  courseId: string;
  startedAt: Date;
  lastActiveAt: Date;
};
type MessageRow = { createdAt: Date; aiChatSession: { courseId: string } };

type StatsFixture = {
  counts?: Partial<Record<"total" | "admin" | "dosen" | "mahasiswa", number>>;
  courses?: CourseRow[];
  enrollments?: EnrollmentRow[];
  chatSessions?: SessionRow[];
  chatMessages?: MessageRow[];
};

const PROGRAM_A = {
  id: "program-a",
  name: "Informatika",
  faculty: { name: "Fakultas Teknik" },
};
const PROGRAM_B = {
  id: "program-b",
  name: "Sistem Informasi",
  faculty: { name: "Fakultas Ilmu Komputer" },
};

const RECENT_INTERACTION = new Date("2026-01-28T10:00:00.000Z");
const STALE_INTERACTION = new Date("2025-12-20T10:00:00.000Z");
const PERIOD = { from: "2026-01-01", to: "2026-01-31" };

function populatedCourses(): CourseRow[] {
  return [
    {
      id: "course-1",
      title: "Pemrograman Web",
      courseCode: "IF101",
      isActive: true,
      catalogStatus: "PUBLISHED",
      studyProgram: PROGRAM_A,
      _count: { enrollments: 3 },
    },
    {
      id: "course-2",
      title: "Basis Data",
      courseCode: "IF102",
      isActive: true,
      catalogStatus: "DRAFT",
      studyProgram: PROGRAM_A,
      _count: { enrollments: 1 },
    },
    {
      id: "course-3",
      title: "=cmd|' /C calc'!A0",
      courseCode: "SI101",
      isActive: false,
      catalogStatus: "PUBLISHED",
      studyProgram: PROGRAM_B,
      _count: { enrollments: 0 },
    },
  ];
}

function populatedFixture(): StatsFixture {
  return {
    courses: populatedCourses(),
    enrollments: [
      { courseId: "course-1", enrolledAt: new Date("2026-01-05T08:00:00.000Z") },
      { courseId: "course-1", enrolledAt: new Date("2026-01-06T08:00:00.000Z") },
      { courseId: "course-1", enrolledAt: new Date("2026-01-07T08:00:00.000Z") },
      { courseId: "course-2", enrolledAt: new Date("2026-01-10T08:00:00.000Z") },
    ],
    chatSessions: [
      {
        courseId: "course-1",
        startedAt: RECENT_INTERACTION,
        lastActiveAt: RECENT_INTERACTION,
      },
      {
        courseId: "course-2",
        startedAt: new Date("2025-11-01T10:00:00.000Z"),
        lastActiveAt: STALE_INTERACTION,
      },
    ],
    chatMessages: [
      {
        createdAt: new Date("2026-01-29T09:00:00.000Z"),
        aiChatSession: { courseId: "course-1" },
      },
      {
        createdAt: new Date("2026-01-30T09:00:00.000Z"),
        aiChatSession: { courseId: "course-1" },
      },
      {
        createdAt: STALE_INTERACTION,
        aiChatSession: { courseId: "course-2" },
      },
    ],
  };
}

async function stubStatsPrisma(fixture: StatsFixture) {
  const { default: prisma } = await import("../src/lib/prisma");
  const client = prisma as any;
  const counts = {
    total: 10,
    admin: 2,
    dosen: 3,
    mahasiswa: 5,
    ...fixture.counts,
  };

  const restores = [
    replaceMethod(client.user, "count", async (args?: { where?: { role?: string } }) => {
      const role = args?.where?.role;
      return role ? counts[role as "admin" | "dosen" | "mahasiswa"] : counts.total;
    }),
    replaceMethod(client.studyProgram, "findUnique", async () => null),
    replaceMethod(client.course, "findMany", async () => fixture.courses ?? []),
    replaceMethod(client.enrollment, "findMany", async () => fixture.enrollments ?? []),
    replaceMethod(client.aiChatSession, "findMany", async () => fixture.chatSessions ?? []),
    replaceMethod(client.aiChatMessage, "findMany", async () => fixture.chatMessages ?? []),
  ];

  return () => restores.forEach((restore) => restore());
}

async function mapPayload<T>(run: () => Promise<T>) {
  const restore = await stubStatsPrisma(populatedFixture());
  try {
    return await run();
  } finally {
    restore();
  }
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

const STUDENT_PERSONAL_DATA = [
  "Budi Santoso",
  "budi@example.com",
  "2101234567",
  "student-1",
];

function assertNoStudentPersonalData(text: string) {
  for (const token of STUDENT_PERSONAL_DATA) {
    assert.equal(text.includes(token), false, `leaked ${token}`);
  }
  assert.equal(/\bnpm\b/.test(text), false, "leaked npm");
}

test("statsFilterSchema accepts a valid range and an empty default filter", () => {
  assert.equal(statsFilterSchema.safeParse(PERIOD).success, true);
  assert.equal(statsFilterSchema.safeParse({}).success, true);
  assert.equal(statsFilterSchema.safeParse({ from: "", to: "" }).success, true);
});

test("statsFilterSchema rejects an impossible calendar date", () => {
  const parsed = statsFilterSchema.safeParse({ from: "2026-02-30" });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error?.issues[0]?.message, INVALID_DATE_RANGE_MESSAGE);
});

test("statsFilterSchema rejects from > to with the FSD message", () => {
  const parsed = statsFilterSchema.safeParse({
    from: "2026-02-01",
    to: "2026-01-01",
  });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error?.issues[0]?.message, "Rentang tanggal tidak valid.");
});

test("statsExportQuerySchema requires csv or pdf alongside the date range", () => {
  assert.equal(statsExportQuerySchema.safeParse({ format: "csv" }).success, true);
  assert.equal(statsExportQuerySchema.safeParse({ format: "pdf" }).success, true);
  assert.equal(statsExportQuerySchema.safeParse({ format: "xlsx" }).success, false);
  assert.equal(statsExportQuerySchema.safeParse({}).success, false);
  assert.equal(
    statsExportQuerySchema.safeParse({
      format: "csv",
      from: "2026-02-01",
      to: "2026-01-01",
    }).success,
    false
  );
});

test("getGlobalDashboardStats aggregates KPI, programs, and daily trend", async () => {
  const report = await mapPayload(() => getGlobalDashboardStats(PERIOD));

  assert.equal(report.total, 10);
  assert.equal(report.admin, 2);
  assert.equal(report.dosen, 3);
  assert.equal(report.mahasiswa, 5);
  assert.equal(report.totalCourses, 3);
  assert.equal(report.activeCourses, 2);
  assert.equal(report.totalEnrollments, 4);
  assert.equal(report.hasActivityData, true);
  assert.deepEqual(report.kpis, {
    totalUsers: 10,
    admin: 2,
    dosen: 3,
    mahasiswa: 5,
    totalCourses: 3,
    activeCourses: 2,
    publishedCourses: 2,
    totalEnrollments: 4,
    periodEnrollments: 4,
    chatSessions: 1,
    chatMessages: 2,
    inactiveCourseCount: 2,
  });
  assert.equal(report.filters.from, PERIOD.from);
  assert.equal(report.filters.to, PERIOD.to);
  assert.equal(report.filters.studyProgramId, null);

  const programA = report.studyProgramDistribution.find(
    (program) => program.studyProgramId === PROGRAM_A.id
  );
  assert.ok(programA);
  assert.equal(programA.studyProgramName, PROGRAM_A.name);
  assert.equal(programA.facultyName, PROGRAM_A.faculty.name);
  assert.equal(programA.courseCount, 2);
  assert.equal(programA.publishedCourseCount, 1);
  assert.equal(programA.enrollmentCount, 4);
  assert.equal(programA.chatSessionCount, 1);
  assert.equal(programA.messageCount, 2);
  assert.equal(programA.inactiveCourseCount, 1);

  const programB = report.studyProgramDistribution.find(
    (program) => program.studyProgramId === PROGRAM_B.id
  );
  assert.ok(programB);
  assert.equal(programB.courseCount, 1);
  assert.equal(programB.inactiveCourseCount, 1);

  assert.equal(report.activityTrend.length, 31);
  const trendByDate = new Map(
    report.activityTrend.map((bucket) => [bucket.date, bucket])
  );
  assert.equal(trendByDate.get("2026-01-28")?.chatSessions, 1);
  assert.equal(trendByDate.get("2026-01-29")?.messages, 1);
  assert.equal(trendByDate.get("2026-01-30")?.messages, 1);
  const totals = report.activityTrend.reduce(
    (sum, bucket) => ({
      chatSessions: sum.chatSessions + bucket.chatSessions,
      messages: sum.messages + bucket.messages,
      enrollments: sum.enrollments + bucket.enrollments,
    }),
    { chatSessions: 0, messages: 0, enrollments: 0 }
  );
  assert.deepEqual(totals, { chatSessions: 1, messages: 2, enrollments: 4 });
});

test("BR-014: payload, CSV, and PDF expose aggregates only, never student data", async () => {
  const report = await mapPayload(() => getGlobalDashboardStats(PERIOD));

  const keys = collectKeys(report);
  for (const forbidden of ["npm", "email", "name", "userId"]) {
    assert.equal(keys.has(forbidden), false, `payload key ${forbidden}`);
  }
  assertNoStudentPersonalData(JSON.stringify(report));

  const csv = generateGlobalReportCsv(report);
  assertNoStudentPersonalData(csv);

  const pdf = generateGlobalReportPdf(report).toString("latin1");
  assertNoStudentPersonalData(pdf);
});

test("BR-015: courses inactive > 28 days or never used are reported", async () => {
  const report = await mapPayload(() => getGlobalDashboardStats(PERIOD));

  assert.equal(INACTIVE_COURSE_THRESHOLD_DAYS, 28);
  assert.deepEqual(
    report.inactiveCourses.map((course) => course.courseId).sort(),
    ["course-2", "course-3"]
  );

  const stale = report.inactiveCourses.find(
    (course) => course.courseId === "course-2"
  );
  assert.ok(stale);
  assert.equal(stale.daysSinceInteraction, 42);
  assert.ok((stale.daysSinceInteraction ?? 0) > INACTIVE_COURSE_THRESHOLD_DAYS);

  const never = report.inactiveCourses.find(
    (course) => course.courseId === "course-3"
  );
  assert.ok(never);
  assert.equal(never.lastInteractionAt, null);
  assert.equal(never.daysSinceInteraction, null);

  assert.equal(
    report.inactiveCourses.some((course) => course.courseId === "course-1"),
    false,
    "recent interaction must stay active"
  );
});

test("ALT-1: an empty period reports hasActivityData=false", async () => {
  const restore = await stubStatsPrisma({
    courses: populatedCourses(),
    enrollments: [],
    chatSessions: [],
    chatMessages: [],
  });

  let report: Awaited<ReturnType<typeof getGlobalDashboardStats>>;
  try {
    report = await getGlobalDashboardStats(PERIOD);
  } finally {
    restore();
  }

  assert.equal(report.hasActivityData, false);
  assert.equal(report.kpis.periodEnrollments, 0);
  assert.equal(report.kpis.chatSessions, 0);
  assert.equal(report.kpis.chatMessages, 0);
  assert.equal(report.kpis.inactiveCourseCount, 3);
  assert.equal(report.activityTrend.length, 31);
  assert.equal(
    report.activityTrend.every(
      (bucket) =>
        bucket.chatSessions === 0 && bucket.messages === 0 && bucket.enrollments === 0
    ),
    true
  );

  const csv = generateGlobalReportCsv(report);
  assert.ok(csv.includes("Tidak ada data aktivitas"));
});

test("CSV neutralises formula injection and contains every section", async () => {
  const report = await mapPayload(() => getGlobalDashboardStats(PERIOD));
  const csv = generateGlobalReportCsv(report);

  assert.ok(csv.includes("Laporan Dashboard Global Tutor AI"));
  assert.ok(csv.includes("KPI,Nilai"));
  assert.ok(csv.includes("Sebaran Program Studi"));
  assert.ok(csv.includes("Tren Aktivitas"));
  assert.ok(csv.includes("Mata Kuliah Nonaktif"));
  assert.ok(csv.includes("'=cmd"));
  assert.equal(csv.includes(",=cmd"), false);
});

test("PDF report has a %PDF-1.4 header and %%EOF trailer", async () => {
  const report = await mapPayload(() => getGlobalDashboardStats(PERIOD));
  const pdf = generateGlobalReportPdf(report);

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.equal(pdf.toString("latin1").trimEnd().endsWith("%%EOF"), true);
});

async function withSession(session: unknown, run: () => Promise<void>) {
  const { auth } = await import("../src/lib/auth");
  const restore = replaceMethod(auth.api, "getSession", async () => session);
  try {
    await run();
  } finally {
    restore();
  }
}

const ADMIN_SESSION = {
  user: { id: "admin-1", role: "admin" },
  session: { id: "session-1" },
};

test("GET /api/admin/stats returns 401 without a session and 403 for non-admin", async () => {
  await withSession(null, async () => {
    const { GET } = await import("../src/app/api/admin/stats/route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/stats")
    );
    assert.equal(response.status, 401);
  });

  await withSession({ user: { id: "student-1", role: "mahasiswa" } }, async () => {
    const { GET } = await import("../src/app/api/admin/stats/route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/stats")
    );
    assert.equal(response.status, 403);
  });
});

test("GET /api/admin/stats rejects from > to with 400", async () => {
  await withSession(ADMIN_SESSION, async () => {
    const { GET } = await import("../src/app/api/admin/stats/route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/stats?from=2026-02-01&to=2026-01-01"
      )
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Rentang tanggal tidak valid.",
    });
  });
});

test("GET /api/admin/stats returns the dashboard JSON", async () => {
  const restore = await stubStatsPrisma(populatedFixture());
  try {
    await withSession(ADMIN_SESSION, async () => {
      const { GET } = await import("../src/app/api/admin/stats/route");
      const response = await GET(
        new NextRequest(
          "http://localhost/api/admin/stats?from=2026-01-01&to=2026-01-31"
        )
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.kpis.chatSessions, 1);
      assert.equal(body.inactiveCourses.length, 2);
    });
  } finally {
    restore();
  }
});

test("GET /api/admin/stats/export returns 401/403 and 400 for invalid input", async () => {
  await withSession(null, async () => {
    const { GET } = await import("../src/app/api/admin/stats/export/route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/stats/export?format=csv")
    );
    assert.equal(response.status, 401);
  });

  await withSession({ user: { id: "dosen-1", role: "dosen" } }, async () => {
    const { GET } = await import("../src/app/api/admin/stats/export/route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/stats/export?format=csv")
    );
    assert.equal(response.status, 403);
  });

  await withSession(ADMIN_SESSION, async () => {
    const { GET } = await import("../src/app/api/admin/stats/export/route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/stats/export?format=csv&from=2026-02-01&to=2026-01-01"
      )
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Rentang tanggal tidak valid.",
    });
  });
});

test("GET /api/admin/stats/export streams CSV and PDF attachments", async () => {
  const restore = await stubStatsPrisma(populatedFixture());
  try {
    await withSession(ADMIN_SESSION, async () => {
      const { GET } = await import("../src/app/api/admin/stats/export/route");

      const csvResponse = await GET(
        new NextRequest(
          "http://localhost/api/admin/stats/export?format=csv&from=2026-01-01&to=2026-01-31"
        )
      );
      assert.equal(csvResponse.status, 200);
      assert.ok(csvResponse.headers.get("content-type")?.startsWith("text/csv"));
      assert.ok(
        csvResponse.headers.get("content-disposition")?.startsWith("attachment;")
      );
      assert.ok((await csvResponse.text()).includes("'=cmd"));

      const pdfResponse = await GET(
        new NextRequest(
          "http://localhost/api/admin/stats/export?format=pdf&from=2026-01-01&to=2026-01-31"
        )
      );
      assert.equal(pdfResponse.status, 200);
      assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
      assert.ok(
        pdfResponse.headers.get("content-disposition")?.startsWith("attachment;")
      );
      const pdf = Buffer.from(await pdfResponse.arrayBuffer());
      assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
      assert.equal(pdf.toString("latin1").trimEnd().endsWith("%%EOF"), true);
    });
  } finally {
    restore();
  }
});
