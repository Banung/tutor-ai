import prisma from "@/lib/prisma";
import {
  INVALID_DATE_RANGE_MESSAGE,
  type StatsFilter,
} from "@/lib/schemas/stats.schema";

export class StatsServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "StatsServiceError";
  }
}

/** BR-015: four weeks without interaction marks a course inactive. */
export const INACTIVE_COURSE_THRESHOLD_DAYS = 28;

const DAY_MS = 86_400_000;
const INACTIVE_COURSE_THRESHOLD_MS = INACTIVE_COURSE_THRESHOLD_DAYS * DAY_MS;
const UNASSIGNED_LABEL = "Belum Ditentukan";

export type ActivityTrendBucket = {
  date: string;
  chatSessions: number;
  messages: number;
  enrollments: number;
};

export type StudyProgramStat = {
  studyProgramId: string | null;
  studyProgramName: string;
  facultyName: string | null;
  courseCount: number;
  publishedCourseCount: number;
  enrollmentCount: number;
  chatSessionCount: number;
  messageCount: number;
  inactiveCourseCount: number;
};

export type InactiveCourseStat = {
  courseId: string;
  courseCode: string;
  title: string;
  studyProgramName: string;
  facultyName: string;
  catalogStatus: string;
  enrollmentCount: number;
  lastInteractionAt: string | null;
  daysSinceInteraction: number | null;
};

export type StatsFilterMetadata = {
  from: string;
  to: string;
  studyProgramId: string | null;
  studyProgramName: string | null;
  facultyName: string | null;
  periodStart: string;
  periodEnd: string;
};

export type GlobalDashboardReport = {
  total: number;
  admin: number;
  dosen: number;
  mahasiswa: number;
  totalCourses: number;
  activeCourses: number;
  totalEnrollments: number;
  filters: StatsFilterMetadata;
  hasActivityData: boolean;
  kpis: {
    totalUsers: number;
    admin: number;
    dosen: number;
    mahasiswa: number;
    totalCourses: number;
    activeCourses: number;
    publishedCourses: number;
    totalEnrollments: number;
    periodEnrollments: number;
    chatSessions: number;
    chatMessages: number;
    inactiveCourseCount: number;
  };
  activityTrend: ActivityTrendBucket[];
  studyProgramDistribution: StudyProgramStat[];
  inactiveCourses: InactiveCourseStat[];
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day));
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function resolvePeriod(filter: StatsFilter, now: Date) {
  let periodStart: Date;
  if (filter.from) {
    periodStart = parseDateOnly(filter.from, false);
  } else if (filter.to) {
    periodStart = new Date(parseDateOnly(filter.to, false).getTime() - 29 * DAY_MS);
  } else {
    periodStart = new Date(startOfUtcDay(now) - 29 * DAY_MS);
  }

  const periodEnd = filter.to ? parseDateOnly(filter.to, true) : now;

  if (periodStart.getTime() > periodEnd.getTime()) {
    throw new StatsServiceError(INVALID_DATE_RANGE_MESSAGE, 400);
  }

  return { periodStart, periodEnd };
}

function increment<T extends string>(counts: Map<T, number>, key: T) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function toIsoDateFromTimestamp(value: Date | number) {
  const date = new Date(value);
  return dateOnly(date);
}

export async function getGlobalDashboardStats(
  filter: StatsFilter = {},
  now = new Date()
): Promise<GlobalDashboardReport> {
  const selectedProgram = filter.studyProgramId
    ? await prisma.studyProgram.findUnique({
        where: { id: filter.studyProgramId },
        include: { faculty: { select: { name: true } } },
      })
    : null;

  if (filter.studyProgramId && !selectedProgram) {
    throw new StatsServiceError("Program studi tidak ditemukan.", 400);
  }

  const { periodStart, periodEnd } = resolvePeriod(filter, now);
  const courseWhere = filter.studyProgramId
    ? { studyProgramId: filter.studyProgramId }
    : {};

  const [total, admin, dosen, mahasiswa, courses] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "dosen" } }),
    prisma.user.count({ where: { role: "mahasiswa" } }),
    prisma.course.findMany({
      where: courseWhere,
      select: {
        id: true,
        title: true,
        courseCode: true,
        isActive: true,
        catalogStatus: true,
        studyProgram: {
          select: { id: true, name: true, faculty: { select: { name: true } } },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { title: "asc" },
    }),
  ]);

  const courseIds = courses.map((course) => course.id);
  const hasCourses = courseIds.length > 0;

  const [enrollments, chatSessions, chatMessages] = hasCourses
    ? await Promise.all([
        prisma.enrollment.findMany({
          where: {
            courseId: { in: courseIds },
            enrolledAt: { gte: periodStart, lte: periodEnd },
          },
          select: { courseId: true, enrolledAt: true },
        }),
        prisma.aiChatSession.findMany({
          where: {
            courseId: { in: courseIds },
            startedAt: { lte: periodEnd },
          },
          select: {
            courseId: true,
            startedAt: true,
            lastActiveAt: true,
          },
        }),
        prisma.aiChatMessage.findMany({
          where: {
            aiChatSession: { courseId: { in: courseIds } },
            createdAt: { lte: periodEnd },
          },
          select: {
            createdAt: true,
            aiChatSession: { select: { courseId: true } },
          },
        }),
      ])
    : [[], [], []];

  const periodEnrollments = enrollments.filter(
    (row) => row.enrolledAt >= periodStart && row.enrolledAt <= periodEnd
  );
  const periodSessions = chatSessions.filter(
    (row) => row.startedAt >= periodStart && row.startedAt <= periodEnd
  );
  const periodMessages = chatMessages.filter(
    (row) => row.createdAt >= periodStart && row.createdAt <= periodEnd
  );

  const sessionsPerCourse = new Map<string, number>();
  for (const row of periodSessions) increment(sessionsPerCourse, row.courseId);

  const messagesPerCourse = new Map<string, number>();
  for (const row of periodMessages) {
    increment(messagesPerCourse, row.aiChatSession.courseId);
  }

  const lastInteractionByCourse = new Map<string, number>();
  const recordInteraction = (courseId: string, value: Date | null) => {
    if (!value) return;
    const timestamp = value.getTime();
    if (timestamp > periodEnd.getTime()) return;
    const current = lastInteractionByCourse.get(courseId);
    if (current === undefined || timestamp > current) {
      lastInteractionByCourse.set(courseId, timestamp);
    }
  };
  for (const row of chatSessions) {
    recordInteraction(row.courseId, row.startedAt);
    recordInteraction(row.courseId, row.lastActiveAt);
  }
  for (const row of chatMessages) {
    recordInteraction(row.aiChatSession.courseId, row.createdAt);
  }

  const trendCounts = new Map<
    string,
    { chatSessions: number; messages: number; enrollments: number }
  >();
  for (
    let cursor = startOfUtcDay(periodStart);
    cursor <= periodEnd.getTime();
    cursor += DAY_MS
  ) {
    trendCounts.set(dateOnly(new Date(cursor)), {
      chatSessions: 0,
      messages: 0,
      enrollments: 0,
    });
  }
  for (const row of periodSessions) {
    const bucket = trendCounts.get(toIsoDateFromTimestamp(row.startedAt));
    if (bucket) bucket.chatSessions += 1;
  }
  for (const row of periodMessages) {
    const bucket = trendCounts.get(toIsoDateFromTimestamp(row.createdAt));
    if (bucket) bucket.messages += 1;
  }
  for (const row of periodEnrollments) {
    const bucket = trendCounts.get(toIsoDateFromTimestamp(row.enrolledAt));
    if (bucket) bucket.enrollments += 1;
  }
  const activityTrend: ActivityTrendBucket[] = [...trendCounts.entries()].map(
    ([date, counts]) => ({ date, ...counts })
  );

  type ProgramAccumulator = StudyProgramStat & { sortKey: string };
  const programStats = new Map<string, ProgramAccumulator>();

  const inactiveCourses: InactiveCourseStat[] = [];
  const referenceTime = periodEnd.getTime();

  for (const course of courses) {
    const programId = course.studyProgram?.id ?? null;
    const programKey = programId ?? "__unassigned__";
    let stats = programStats.get(programKey);
    if (!stats) {
      stats = {
        studyProgramId: programId,
        studyProgramName: course.studyProgram?.name ?? UNASSIGNED_LABEL,
        facultyName: course.studyProgram?.faculty?.name ?? null,
        courseCount: 0,
        publishedCourseCount: 0,
        enrollmentCount: 0,
        chatSessionCount: 0,
        messageCount: 0,
        inactiveCourseCount: 0,
        sortKey: programId ?? "~",
      };
      programStats.set(programKey, stats);
    }

    stats.courseCount += 1;
    stats.enrollmentCount += course._count.enrollments;
    stats.chatSessionCount += sessionsPerCourse.get(course.id) ?? 0;
    stats.messageCount += messagesPerCourse.get(course.id) ?? 0;
    if (course.catalogStatus === "PUBLISHED") stats.publishedCourseCount += 1;

    const lastInteractionAt = lastInteractionByCourse.get(course.id) ?? null;
    const isInactive =
      lastInteractionAt === null ||
      referenceTime - lastInteractionAt > INACTIVE_COURSE_THRESHOLD_MS;

    if (isInactive) {
      stats.inactiveCourseCount += 1;
      inactiveCourses.push({
        courseId: course.id,
        courseCode: course.courseCode ?? "",
        title: course.title,
        studyProgramName: course.studyProgram?.name ?? UNASSIGNED_LABEL,
        facultyName: course.studyProgram?.faculty?.name ?? "-",
        catalogStatus: course.catalogStatus,
        enrollmentCount: course._count.enrollments,
        lastInteractionAt:
          lastInteractionAt === null
            ? null
            : new Date(lastInteractionAt).toISOString(),
        daysSinceInteraction:
          lastInteractionAt === null
            ? null
            : Math.floor((referenceTime - lastInteractionAt) / DAY_MS),
      });
    }
  }

  inactiveCourses.sort((left, right) => {
    const leftTime = left.lastInteractionAt
      ? Date.parse(left.lastInteractionAt)
      : -Infinity;
    const rightTime = right.lastInteractionAt
      ? Date.parse(right.lastInteractionAt)
      : -Infinity;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title);
  });

  const studyProgramDistribution = [...programStats.values()]
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map(({ sortKey: _sortKey, ...rest }) => rest);

  const totalEnrollments = courses.reduce(
    (sum, course) => sum + course._count.enrollments,
    0
  );
  const publishedCourses = courses.filter(
    (course) => course.catalogStatus === "PUBLISHED"
  ).length;
  const activeCourses = courses.filter((course) => course.isActive).length;

  const hasActivityData =
    periodEnrollments.length > 0 ||
    periodSessions.length > 0 ||
    periodMessages.length > 0;

  return {
    total,
    admin,
    dosen,
    mahasiswa,
    totalCourses: courses.length,
    activeCourses,
    totalEnrollments,
    filters: {
      from: filter.from ?? dateOnly(periodStart),
      to: filter.to ?? dateOnly(periodEnd),
      studyProgramId: filter.studyProgramId ?? null,
      studyProgramName: selectedProgram?.name ?? null,
      facultyName: selectedProgram?.faculty?.name ?? null,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    },
    hasActivityData,
    kpis: {
      totalUsers: total,
      admin,
      dosen,
      mahasiswa,
      totalCourses: courses.length,
      activeCourses,
      publishedCourses,
      totalEnrollments,
      periodEnrollments: periodEnrollments.length,
      chatSessions: periodSessions.length,
      chatMessages: periodMessages.length,
      inactiveCourseCount: inactiveCourses.length,
    },
    activityTrend,
    studyProgramDistribution,
    inactiveCourses,
  };
}

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (CSV_FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function reportMetadataRows(report: GlobalDashboardReport) {
  return [
    ["Periode", `${report.filters?.from ?? "-"} s/d ${report.filters?.to ?? "-"}`],
    ["Program Studi", report.filters?.studyProgramName ?? "Semua Program Studi"],
    ["Fakultas", report.filters?.facultyName ?? "-"],
    [
      "Status Data",
      report.hasActivityData ? "Data aktivitas tersedia" : "Tidak ada data aktivitas",
    ],
  ];
}

export function generateGlobalReportCsv(report: GlobalDashboardReport): string {
  const rows: Array<Array<string | number>> = [
    ["Laporan Dashboard Global Tutor AI"],
    ...reportMetadataRows(report),
    [],
    ["KPI", "Nilai"],
    ["Total Pengguna", report.kpis.totalUsers],
    ["Admin", report.kpis.admin],
    ["Dosen", report.kpis.dosen],
    ["Mahasiswa", report.kpis.mahasiswa],
    ["Total Mata Kuliah", report.kpis.totalCourses],
    ["Mata Kuliah Aktif", report.kpis.activeCourses],
    ["Mata Kuliah Dipublikasikan", report.kpis.publishedCourses],
    ["Total Pendaftaran", report.kpis.totalEnrollments],
    ["Pendaftaran Periode", report.kpis.periodEnrollments],
    ["Sesi Chat", report.kpis.chatSessions],
    ["Pesan Chat", report.kpis.chatMessages],
    ["Mata Kuliah Nonaktif", report.kpis.inactiveCourseCount],
    [],
    ["Sebaran Program Studi"],
    [
      "Program Studi",
      "Fakultas",
      "Mata Kuliah",
      "Dipublikasikan",
      "Pendaftaran",
      "Sesi Chat",
      "Pesan",
      "MK Nonaktif",
    ],
  ];

  for (const program of report.studyProgramDistribution) {
    rows.push([
      program.studyProgramName,
      program.facultyName ?? "-",
      program.courseCount,
      program.publishedCourseCount,
      program.enrollmentCount,
      program.chatSessionCount,
      program.messageCount,
      program.inactiveCourseCount,
    ]);
  }

  rows.push([], ["Tren Aktivitas"], ["Tanggal", "Sesi Chat", "Pesan", "Pendaftaran"]);
  if (report.activityTrend.length === 0) {
    rows.push(["Tidak ada data aktivitas"]);
  }
  for (const bucket of report.activityTrend) {
    rows.push([
      bucket.date,
      bucket.chatSessions,
      bucket.messages,
      bucket.enrollments,
    ]);
  }

  rows.push(
    [],
    ["Mata Kuliah Nonaktif"],
    [
      "Kode MK",
      "Judul",
      "Program Studi",
      "Fakultas",
      "Status Katalog",
      "Pendaftaran",
      "Interaksi Terakhir",
      "Hari Sejak Interaksi",
    ]
  );
  if (report.inactiveCourses.length === 0) {
    rows.push(["Tidak ada mata kuliah nonaktif"]);
  }
  for (const course of report.inactiveCourses) {
    rows.push([
      course.courseCode,
      course.title,
      course.studyProgramName,
      course.facultyName,
      course.catalogStatus,
      course.enrollmentCount,
      course.lastInteractionAt ?? "-",
      course.daysSinceInteraction ?? "-",
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function pdfSafe(value: string) {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function pdfEscape(value: string) {
  return pdfSafe(value).replace(/[\\()]/g, (match) => `\\${match}`);
}

export function generateGlobalReportPdf(report: GlobalDashboardReport): Buffer {
  const lines: string[] = [
    "Laporan Dashboard Global Tutor AI",
    ...reportMetadataRows(report).map(([label, value]) => `${label}: ${value}`),
    "",
    "KPI",
    `Total Pengguna: ${report.kpis.totalUsers}`,
    `Admin: ${report.kpis.admin} | Dosen: ${report.kpis.dosen} | Mahasiswa: ${report.kpis.mahasiswa}`,
    `Total Mata Kuliah: ${report.kpis.totalCourses}`,
    `Mata Kuliah Aktif: ${report.kpis.activeCourses} | Dipublikasikan: ${report.kpis.publishedCourses}`,
    `Total Pendaftaran: ${report.kpis.totalEnrollments} | Pendaftaran Periode: ${report.kpis.periodEnrollments}`,
    `Sesi Chat: ${report.kpis.chatSessions} | Pesan Chat: ${report.kpis.chatMessages}`,
    `Mata Kuliah Nonaktif: ${report.kpis.inactiveCourseCount}`,
    "",
    "Sebaran Program Studi",
  ];

  for (const program of report.studyProgramDistribution) {
    lines.push(
      `${program.studyProgramName} (${program.facultyName ?? "-"}): ` +
        `${program.courseCount} MK, ${program.publishedCourseCount} publikasi, ` +
        `${program.enrollmentCount} pendaftaran, ${program.chatSessionCount} sesi, ` +
        `${program.messageCount} pesan, ${program.inactiveCourseCount} nonaktif`
    );
  }
  if (report.studyProgramDistribution.length === 0) {
    lines.push("Tidak ada data program studi");
  }

  lines.push("", "Tren Aktivitas");
  if (report.activityTrend.length === 0) {
    lines.push("Tidak ada data aktivitas");
  }
  for (const bucket of report.activityTrend) {
    lines.push(
      `${bucket.date}: ${bucket.chatSessions} sesi, ${bucket.messages} pesan, ` +
        `${bucket.enrollments} pendaftaran`
    );
  }

  lines.push("", "Mata Kuliah Nonaktif");
  if (report.inactiveCourses.length === 0) {
    lines.push("Tidak ada mata kuliah nonaktif");
  }
  for (const course of report.inactiveCourses) {
    const last = course.lastInteractionAt ?? "belum ada interaksi";
    const days =
      course.daysSinceInteraction === null
        ? "-"
        : `${course.daysSinceInteraction} hari`;
    lines.push(
      `${course.courseCode || "-"} ${course.title} (${course.studyProgramName}, ` +
        `${course.facultyName}, ${course.catalogStatus}): ${course.enrollmentCount} ` +
        `pendaftaran, interaksi terakhir ${last}, ${days}`
    );
  }

  const linesPerPage = 46;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const pageCount = pages.length;
  const pageIds = pages.map((_, index) => 4 + index);
  const contentIds = pages.map((_, index) => 4 + pageCount + index);

  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageCount} >>`;
  objects[2] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  pages.forEach((pageLines, index) => {
    objects[3 + index] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
  });

  pages.forEach((pageLines, index) => {
    const text = pageLines
      .map((line) => `(${pdfEscape(line)}) Tj T*`)
      .join("\n");
    const stream = `BT\n/F1 10 Tf\n14 TL\n48 744 Td\n${text}\nET`;
    objects[3 + pageCount + index] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  let offset = chunks[0].length;
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets[index] = offset;
    const objectBuffer = Buffer.from(
      `${index + 1} 0 obj\n${body}\nendobj\n`,
      "latin1"
    );
    chunks.push(objectBuffer);
    offset += objectBuffer.length;
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const objectOffset of offsets) {
    xref += `${String(objectOffset).padStart(10, "0")} 00000 n \n`;
  }
  xref +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}
