import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export class DosenUsageAnalyticsError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "DosenUsageAnalyticsError";
  }
}

export type UsagePeriod = 7 | 30 | 90;

export interface DosenUsageAnalytics {
  period: UsagePeriod;
  courseId: string | null;
  availableCourses: Array<{ id: string; title: string }>;
  totals: {
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  };
  series: Array<{
    date: string;
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  }>;
  courses: Array<{
    id: string;
    title: string;
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  }>;
}

type AnalyticsRow = {
  rowType: "day" | "course" | "total";
  bucket: string;
  label: string | null;
  sessions: number | bigint;
  activeStudents: number | bigint;
  studentQuestions: number | bigint;
};

function count(value: number | bigint) {
  return Number(value);
}

export async function getDosenUsageAnalytics(
  dosenId: string,
  period: UsagePeriod,
  courseId: string | null
): Promise<DosenUsageAnalytics> {
  const availableCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId: dosenId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  if (courseId && !availableCourses.some((course) => course.id === courseId)) {
    throw new DosenUsageAnalyticsError("Course tidak ditemukan", 404);
  }

  const selectedCourses = courseId
    ? availableCourses.filter((course) => course.id === courseId)
    : availableCourses;
  const selectedCourseIds = selectedCourses.map((course) => course.id);

  const now = new Date();
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const firstDay = new Date(lastDay);
  firstDay.setUTCDate(firstDay.getUTCDate() - period + 1);

  if (selectedCourseIds.length === 0) {
    return {
      period,
      courseId,
      availableCourses,
      totals: { sessions: 0, activeStudents: 0, studentQuestions: 0 },
      series: [],
      courses: [],
    };
  }

  const rows = await prisma.$queryRaw<AnalyticsRow[]>`
    WITH assigned_courses AS (
      SELECT course.id, course.title
      FROM "course" AS course
      INNER JOIN "course_instructor" AS instructor
        ON instructor."courseId" = course.id
      WHERE instructor."userId" = ${dosenId}
        AND course.id IN (${Prisma.join(selectedCourseIds)})
    ),
    scoped_sessions AS (
      SELECT chat_session."courseId", chat_session."startedAt"
      FROM "ai_chat_session" AS chat_session
      INNER JOIN assigned_courses
        ON assigned_courses.id = chat_session."courseId"
      WHERE chat_session."startedAt" >= ${firstDay}
        AND chat_session."startedAt" <= ${now}
    ),
    student_messages AS (
      SELECT
        chat_session."courseId",
        chat_session."userId",
        chat_message."createdAt"::date AS "bucketDay"
      FROM "ai_chat_message" AS chat_message
      INNER JOIN "ai_chat_session" AS chat_session
        ON chat_session."id" = chat_message."aiChatSessionId"
      INNER JOIN assigned_courses
        ON assigned_courses.id = chat_session."courseId"
      INNER JOIN "user" AS student
        ON student."id" = chat_session."userId"
      WHERE student."role" = 'mahasiswa'
        AND chat_message."senderType" = 'user'
        AND chat_message."createdAt" >= ${firstDay}
        AND chat_message."createdAt" <= ${now}
    ),
    session_by_day AS (
      SELECT
        chat_session."startedAt"::date AS "bucketDay",
        COUNT(*)::int AS sessions
      FROM scoped_sessions AS chat_session
      GROUP BY 1
    ),
    message_by_day AS (
      SELECT
        "bucketDay",
        COUNT(*)::int AS questions,
        COUNT(DISTINCT "userId")::int AS "activeStudents"
      FROM student_messages
      GROUP BY "bucketDay"
    ),
    session_by_course AS (
      SELECT "courseId", COUNT(*)::int AS sessions
      FROM scoped_sessions
      GROUP BY "courseId"
    ),
    message_by_course AS (
      SELECT
        "courseId",
        COUNT(*)::int AS questions,
        COUNT(DISTINCT "userId")::int AS "activeStudents"
      FROM student_messages
      GROUP BY "courseId"
    ),
    totals AS (
      SELECT
        (
          SELECT COUNT(*)::int FROM scoped_sessions
        ) AS sessions,
        (SELECT COUNT(DISTINCT "userId")::int FROM student_messages) AS "activeStudents",
        (SELECT COUNT(*)::int FROM student_messages) AS questions
    )
    SELECT
      'day'::text AS "rowType",
      TO_CHAR(calendar."bucketDay"::date, 'YYYY-MM-DD') AS bucket,
      NULL::text AS label,
      COALESCE(session_by_day.sessions, 0)::int AS sessions,
      COALESCE(message_by_day."activeStudents", 0)::int AS "activeStudents",
      COALESCE(message_by_day.questions, 0)::int AS "studentQuestions"
    FROM generate_series(${firstDay}::date, ${lastDay}::date, interval '1 day')
      AS calendar("bucketDay")
    LEFT JOIN session_by_day
      ON session_by_day."bucketDay" = calendar."bucketDay"::date
    LEFT JOIN message_by_day
      ON message_by_day."bucketDay" = calendar."bucketDay"::date

    UNION ALL

    SELECT
      'course'::text AS "rowType",
      course.id AS bucket,
      course.title AS label,
      COALESCE(session_by_course.sessions, 0)::int AS sessions,
      COALESCE(message_by_course."activeStudents", 0)::int AS "activeStudents",
      COALESCE(message_by_course.questions, 0)::int AS "studentQuestions"
    FROM assigned_courses AS course
    LEFT JOIN session_by_course ON session_by_course."courseId" = course.id
    LEFT JOIN message_by_course ON message_by_course."courseId" = course.id

    UNION ALL

    SELECT
      'total'::text AS "rowType",
      'total'::text AS bucket,
      NULL::text AS label,
      totals.sessions,
      totals."activeStudents",
      totals.questions AS "studentQuestions"
    FROM totals
    ORDER BY "rowType", bucket
  `;

  const series = rows
    .filter((row) => row.rowType === "day")
    .map((row) => ({
      date: row.bucket,
      sessions: count(row.sessions),
      activeStudents: count(row.activeStudents),
      studentQuestions: count(row.studentQuestions),
    }));

  const courseMetrics = new Map(
    rows
      .filter((row) => row.rowType === "course")
      .map((row) => [row.bucket, row])
  );
  const courses = selectedCourses.map((course) => {
    const metrics = courseMetrics.get(course.id);
    return {
      ...course,
      sessions: metrics ? count(metrics.sessions) : 0,
      activeStudents: metrics ? count(metrics.activeStudents) : 0,
      studentQuestions: metrics ? count(metrics.studentQuestions) : 0,
    };
  });

  const totals = rows.find((row) => row.rowType === "total");

  return {
    period,
    courseId,
    availableCourses,
    totals: {
      sessions: totals ? count(totals.sessions) : 0,
      activeStudents: totals ? count(totals.activeStudents) : 0,
      studentQuestions: totals ? count(totals.studentQuestions) : 0,
    },
    series,
    courses,
  };
}
