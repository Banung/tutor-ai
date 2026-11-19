import prisma from "@/lib/prisma";
import type { CreateCourseInput } from "@/lib/schemas/course.schema";
import { generateCourseCover, isCurrentCourseCover, isCustomCourseCover } from "@/lib/course-cover";
import { deleteMaterialFilesFromSupabase } from "@/lib/supabase-storage";

export class DosenServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "DosenServiceError";
  }
}

/* ─── Helpers ──────────────────────────────────────── */

function generateEnrollmentKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

/** Convert BigInt values in an object to string for JSON serialization */
function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

type CourseWithCover = {
  id: string;
  title: string;
  enrollmentKey: string;
  coverImage: string | null;
};

const materialSelect = {
  id: true,
  title: true,
  materialType: true,
  description: true,
  fileName: true,
  filePath: true,
  storagePath: true,
  publicUrl: true,
  externalUrl: true,
  textContent: true,
  fileSize: true,
  isActive: true,
  isProcessed: true,
  processingStatus: true,
  processingProgress: true,
  processingError: true,
  processingJobId: true,
  processingStartedAt: true,
  processingCompletedAt: true,
  pageCount: true,
  chunkCount: true,
  embeddingModel: true,
  embeddingDimensions: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function ensureCourseCover<T extends CourseWithCover>(course: T): Promise<T> {
  if (isCurrentCourseCover(course.coverImage) || isCustomCourseCover(course.coverImage)) {
    return course;
  }

  const coverImage = generateCourseCover(course);
  await prisma.course.update({
    where: { id: course.id },
    data: { coverImage },
  });

  return { ...course, coverImage };
}

async function ensureCourseCovers<T extends CourseWithCover>(courses: T[]) {
  return Promise.all(courses.map(ensureCourseCover));
}

function assertEnrollmentKey(expectedKey: string, submittedKey: string) {
  if (submittedKey.trim().toUpperCase() !== expectedKey.toUpperCase()) {
    throw new DosenServiceError("Enrollment key tidak sesuai", 400);
  }
}

async function getAuthorizedCourse(courseId: string, dosenId: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      instructors: { some: { userId: dosenId } },
    },
    select: { id: true, enrollmentKey: true },
  });

  if (!course) {
    throw new DosenServiceError("Course tidak ditemukan", 404);
  }

  return course;
}

async function verifyCourseKey(courseId: string, dosenId: string, enrollmentKey: string) {
  const course = await getAuthorizedCourse(courseId, dosenId);
  assertEnrollmentKey(course.enrollmentKey, enrollmentKey);
  return course;
}

/* ─── Courses ──────────────────────────────────────── */

export async function listDosenCourses(dosenId: string, search?: string) {
  const whereClause: Record<string, unknown> = {
    instructors: { some: { userId: dosenId } },
  };

  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const courses = await prisma.course.findMany({
    where: whereClause,
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ensureCourseCovers(courses);
}

export async function createDosenCourse(data: CreateCourseInput, dosenId: string) {
  let enrollmentKey = generateEnrollmentKey();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.course.findUnique({ where: { enrollmentKey } });
    if (!existing) break;
    enrollmentKey = generateEnrollmentKey();
    attempts++;
  }

  const courseId = crypto.randomUUID();

  const course = await prisma.course.create({
    data: {
      id: courseId,
      createdBy: dosenId,
      title: data.title,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
      catalogStatus: "DRAFT",
      enrollmentKey,
      coverImage: generateCourseCover({
        id: courseId,
        title: data.title,
        enrollmentKey,
      }),
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });

  await prisma.courseInstructor.create({
    data: { id: crypto.randomUUID(), courseId, userId: dosenId },
  });

  return course;
}

export async function getDosenCourseById(courseId: string, dosenId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      creator: { select: { id: true, name: true } },
      instructors: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { enrollments: true, sessions: true } },
    },
  });

  if (!course) return null;
  const isInstructor = course.instructors.some((i) => i.user.id === dosenId);
  if (!isInstructor) return null;

  return ensureCourseCover(course);
}

export async function updateDosenCourse(
  courseId: string,
  dosenId: string,
  enrollmentKey: string,
  data: {
    title?: string;
    description?: string | null;
    isActive?: boolean;
  }
) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      instructors: { some: { userId: dosenId } },
    },
    select: {
      id: true,
      title: true,
      enrollmentKey: true,
      coverImage: true,
    },
  });

  if (!course) {
    throw new DosenServiceError("Course tidak ditemukan", 404);
  }

  assertEnrollmentKey(course.enrollmentKey, enrollmentKey);
  const nextTitle = data.title ?? course.title;

  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(data.title !== undefined && {
        title: data.title,
        ...(!isCustomCourseCover(course.coverImage) && {
          coverImage: generateCourseCover({
            id: course.id,
            title: nextTitle,
            enrollmentKey: course.enrollmentKey,
          }),
        }),
      }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  return getDosenCourseById(courseId, dosenId);
}

export async function deleteDosenCourse(
  courseId: string,
  dosenId: string,
  enrollmentKey: string
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const materials = await prisma.material.findMany({
    where: { courseSession: { courseId } },
    select: { storagePath: true },
  });

  await deleteMaterialFilesFromSupabase(materials.map((material) => material.storagePath));
  await prisma.course.delete({ where: { id: courseId } });
  return { success: true };
}

/* ─── Stats ────────────────────────────────────────── */

export async function getDosenStats(dosenId: string) {
  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId: dosenId } } },
    select: { id: true },
  });

  const courseIds = courses.map((c) => c.id);

  const [totalCourses, totalStudents, totalSessions] = await Promise.all([
    Promise.resolve(courseIds.length),
    courseIds.length > 0
      ? prisma.enrollment.count({ where: { courseId: { in: courseIds } } })
      : Promise.resolve(0),
    courseIds.length > 0
      ? prisma.courseSession.count({ where: { courseId: { in: courseIds } } })
      : Promise.resolve(0),
  ]);

  return { totalCourses, totalStudents, totalSessions };
}

/* ─── Sessions ─────────────────────────────────────── */

export async function listCourseSessions(courseId: string) {
  const sessions = await prisma.courseSession.findMany({
    where: { courseId },
    include: {
      creator: { select: { id: true, name: true } },
      materials: {
        select: materialSelect,
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { materials: true } },
    },
    orderBy: { orderNumber: "asc" },
  });

  return serializeBigInt(sessions);
}

export async function createCourseSession(
  courseId: string,
  dosenId: string,
  data: { title: string; description?: string | null }
) {
  const lastSession = await prisma.courseSession.findFirst({
    where: { courseId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  const nextOrder = (lastSession?.orderNumber ?? 0) + 1;

  const session = await prisma.courseSession.create({
    data: {
      id: crypto.randomUUID(),
      courseId,
      createdBy: dosenId,
      title: data.title,
      description: data.description ?? null,
      orderNumber: nextOrder,
    },
    include: {
      creator: { select: { id: true, name: true } },
      materials: {
        select: materialSelect,
      },
      _count: { select: { materials: true } },
    },
  });

  return serializeBigInt(session);
}

export async function getCourseSessionInCourse(courseId: string, sessionId: string) {
  return prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true, title: true },
  });
}

export async function updateCourseSessionStatus(
  courseId: string,
  sessionId: string,
  dosenId: string,
  enrollmentKey: string,
  isActive: boolean
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true },
  });

  if (!session) {
    throw new DosenServiceError("Sesi tidak ditemukan", 404);
  }

  return prisma.courseSession.update({
    where: { id: sessionId },
    data: { isActive },
  });
}

export async function updateCourseSession(
  courseId: string,
  sessionId: string,
  dosenId: string,
  enrollmentKey: string,
  data: { title: string; description?: string | null }
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true },
  });

  if (!session) {
    throw new DosenServiceError("Sesi tidak ditemukan", 404);
  }

  return prisma.courseSession.update({
    where: { id: sessionId },
    data: { 
      title: data.title,
      description: data.description ?? null
    },
  });
}

export async function deleteCourseSession(
  courseId: string,
  sessionId: string,
  dosenId: string,
  enrollmentKey: string
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: {
      id: true,
      materials: { select: { storagePath: true } },
    },
  });

  if (!session) {
    throw new DosenServiceError("Sesi tidak ditemukan", 404);
  }

  await deleteMaterialFilesFromSupabase(
    session.materials.map((material) => material.storagePath)
  );
  await prisma.courseSession.delete({ where: { id: sessionId } });
  return { success: true };
}

/* ─── Materials ────────────────────────────────────── */

export async function createMaterial(
  sessionId: string,
  dosenId: string,
  data: {
    title: string;
    materialType: "file" | "link" | "text";
    description?: string | null;
    fileName: string;
    filePath: string;
    storagePath?: string | null;
    publicUrl?: string | null;
    externalUrl?: string | null;
    textContent?: string | null;
    fileSize: number;
  }
) {
  const material = await prisma.material.create({
    data: {
      id: crypto.randomUUID(),
      courseSessionId: sessionId,
      uploadedBy: dosenId,
      title: data.title,
      materialType: data.materialType,
      description: data.description ?? null,
      fileName: data.fileName,
      filePath: data.filePath,
      storagePath: data.storagePath ?? null,
      publicUrl: data.publicUrl ?? null,
      externalUrl: data.externalUrl ?? null,
      textContent: data.textContent ?? null,
      fileSize: BigInt(data.fileSize),
      isProcessed: data.materialType !== "file",
      processingStatus: data.materialType === "file" ? "uploaded" : "ready",
      processingProgress: data.materialType === "file" ? 0 : 100,
      processingCompletedAt: data.materialType === "file" ? null : new Date(),
    },
    select: materialSelect,
  });

  return serializeBigInt(material);
}

export async function updateMaterialStatus(
  courseId: string,
  sessionId: string,
  materialId: string,
  dosenId: string,
  enrollmentKey: string,
  isActive: boolean
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      courseSessionId: sessionId,
      courseSession: { courseId },
    },
    select: { id: true, storagePath: true },
  });

  if (!material) {
    throw new DosenServiceError("Materi tidak ditemukan", 404);
  }

  const updatedMaterial = await prisma.material.update({
    where: { id: materialId },
    data: { isActive },
    select: materialSelect,
  });

  return serializeBigInt(updatedMaterial);
}

export async function updateMaterial(
  courseId: string,
  sessionId: string,
  materialId: string,
  dosenId: string,
  enrollmentKey: string,
  data: {
    title: string;
    description?: string | null;
    externalUrl?: string | null;
    textContent?: string | null;
  }
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      courseSessionId: sessionId,
      courseSession: { courseId },
    },
    select: { id: true },
  });

  if (!material) {
    throw new DosenServiceError("Materi tidak ditemukan", 404);
  }

  const updateData: {
    title: string;
    description: string | null;
    externalUrl?: string | null;
    textContent?: string | null;
  } = {
    title: data.title,
    description: data.description ?? null,
  };

  if (data.externalUrl !== undefined) {
    updateData.externalUrl = data.externalUrl;
  }
  if (data.textContent !== undefined) {
    updateData.textContent = data.textContent;
  }

  const updatedMaterial = await prisma.material.update({
    where: { id: materialId },
    data: updateData,
    select: materialSelect,
  });

  return serializeBigInt(updatedMaterial);
}

export async function deleteMaterial(
  courseId: string,
  sessionId: string,
  materialId: string,
  dosenId: string,
  enrollmentKey: string
) {
  await verifyCourseKey(courseId, dosenId, enrollmentKey);

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      courseSessionId: sessionId,
      courseSession: { courseId },
    },
    select: { id: true, storagePath: true },
  });

  if (!material) {
    throw new DosenServiceError("Materi tidak ditemukan", 404);
  }

  await deleteMaterialFilesFromSupabase([material.storagePath]);
  await prisma.material.delete({ where: { id: materialId } });
  return { success: true };
}

/* ─── Enrollments (Student List) ───────────────────── */

export async function listCourseStudents(courseId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          npm: true,
          major: true,
        },
      },
    },
    orderBy: { user: { npm: "asc" } },
  });

  return enrollments;
}

export async function removeStudentFromCourse(courseId: string, studentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: studentId } },
  });

  if (!enrollment) return null;

  await prisma.enrollment.delete({
    where: { id: enrollment.id },
  });

  return { success: true };
}

/* ─── Recent Activities ────────────────────────────── */

export async function getDosenRecentActivities(dosenId: string, days = 7) {
  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId: dosenId } } },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);
  if (courseIds.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get latest materials across all dosen courses within the date range
  const materials = await prisma.material.findMany({
    where: {
      courseSession: { courseId: { in: courseIds } },
      createdAt: { gte: cutoffDate },
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      filePath: true,
      createdAt: true,
      courseSession: {
        select: {
          title: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get latest sessions created within the date range
  const sessions = await prisma.courseSession.findMany({
    where: { 
      courseId: { in: courseIds },
      createdAt: { gte: cutoffDate },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Merge and sort by createdAt
  type ActivityItem = {
    id: string;
    type: "material" | "session";
    title: string;
    detail: string;
    courseId: string;
    courseName: string;
    createdAt: string;
  };

  const activities: ActivityItem[] = [
    ...materials.map((m) => ({
      id: m.id,
      type: "material" as const,
      title: m.title,
      detail: `${m.courseSession.title} — ${m.fileName}`,
      courseId: m.courseSession.course.id,
      courseName: m.courseSession.course.title,
      createdAt: m.createdAt.toISOString(),
    })),
    ...sessions.map((s) => ({
      id: s.id,
      type: "session" as const,
      title: s.title,
      detail: s.course.title,
      courseId: s.course.id,
      courseName: s.course.title,
      createdAt: s.createdAt.toISOString(),
    })),
  ];

  // Deduplicate: keep only the latest per id
  const seen = new Map<string, ActivityItem>();
  for (const a of activities) {
    const key = `${a.type}-${a.id}`;
    if (!seen.has(key) || a.createdAt > seen.get(key)!.createdAt) {
      seen.set(key, a);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50); // Hard cap at 50 activities to avoid huge payloads
}
