import prisma from "@/lib/prisma";
import { generateCourseCover, isCurrentCourseCover, isCustomCourseCover } from "@/lib/course-cover";

type CourseWithCover = {
  id: string;
  title: string;
  enrollmentKey: string;
  coverImage: string | null;
};

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

function hideEnrollmentKey<T extends CourseWithCover>(course: T): Omit<T, "enrollmentKey"> {
  const safeCourse = { ...course };
  delete (safeCourse as Partial<CourseWithCover>).enrollmentKey;
  return safeCourse;
}

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

export async function listMahasiswaCourses(mahasiswaId: string, search?: string) {
  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      enrollments: {
        some: {
          userId: mahasiswaId,
          isActive: true,
        },
      },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      creator: { select: { id: true, name: true } },
      instructors: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { instructors: true, sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const coursesWithCover = await ensureCourseCovers(courses);
  return coursesWithCover.map(hideEnrollmentKey);
}

export async function searchAvailableCourses(mahasiswaId: string, search?: string) {
  const query = search?.trim();
  if (!query) return [];

  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      catalogStatus: "PUBLISHED",
      enrollments: {
        none: {
          userId: mahasiswaId,
          isActive: true,
        },
      },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      creator: { select: { id: true, name: true } },
      instructors: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { instructors: true, sessions: true } },
    },
    orderBy: { title: "asc" },
    take: 8,
  });

  const coursesWithCover = await ensureCourseCovers(courses);
  return coursesWithCover.map(hideEnrollmentKey);
}

export async function enrollMahasiswaCourse(
  mahasiswaId: string,
  courseId: string,
  enrollmentKey: string
) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isActive: true,
      catalogStatus: "PUBLISHED",
    },
    select: {
      id: true,
      title: true,
      enrollmentKey: true,
    },
  });

  if (!course) {
    throw new Error("Course tidak ditemukan");
  }

  if (course.enrollmentKey.toUpperCase() !== enrollmentKey.trim().toUpperCase()) {
    throw new Error("Enrollment key tidak sesuai");
  }

  const existing = await prisma.enrollment.findUnique({
    where: { courseId_userId: { courseId, userId: mahasiswaId } },
  });

  if (existing?.isActive) {
    throw new Error("Anda sudah terdaftar di course ini");
  }

  if (existing) {
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        id: crypto.randomUUID(),
        courseId,
        userId: mahasiswaId,
      },
    });
  }

  return { success: true, courseId: course.id, courseTitle: course.title };
}

export async function getMahasiswaCourseById(courseId: string, mahasiswaId: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isActive: true,
      enrollments: {
        some: {
          userId: mahasiswaId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      coverImage: true,
      enrollmentKey: true,
      isActive: true,
      createdAt: true,
      creator: { select: { id: true, name: true } },
      instructors: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { instructors: true, sessions: true } },
    },
  });

  if (!course) return null;
  const courseWithCover = await ensureCourseCover(course);

  return {
    id: courseWithCover.id,
    title: courseWithCover.title,
    description: courseWithCover.description,
    coverImage: courseWithCover.coverImage,
    isActive: courseWithCover.isActive,
    createdAt: courseWithCover.createdAt,
    creator: courseWithCover.creator,
    instructors: courseWithCover.instructors,
    _count: courseWithCover._count,
  };
}

export async function listMahasiswaCourseSessions(courseId: string, mahasiswaId: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isActive: true,
      enrollments: {
        some: {
          userId: mahasiswaId,
          isActive: true,
        },
      },
    },
    select: { id: true },
  });

  if (!course) return null;

  const sessions = await prisma.courseSession.findMany({
    where: {
      courseId,
      isActive: true,
    },
    include: {
      creator: { select: { id: true, name: true } },
      materials: {
        where: { isActive: true },
        select: {
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
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { materials: { where: { isActive: true } } } },
    },
    orderBy: { orderNumber: "asc" },
  });

  return serializeBigInt(sessions);
}

export async function getMahasiswaRecentActivities(mahasiswaId: string, days = 7) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: mahasiswaId,
      isActive: true,
      course: { isActive: true },
    },
    select: { courseId: true },
  });

  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  if (courseIds.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const materials = await prisma.material.findMany({
    where: {
      isActive: true,
      createdAt: { gte: cutoffDate },
      courseSession: {
        isActive: true,
        courseId: { in: courseIds },
        course: { isActive: true },
      },
    },
    select: {
      id: true,
      title: true,
      fileName: true,
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

  const sessions = await prisma.courseSession.findMany({
    where: {
      isActive: true,
      courseId: { in: courseIds },
      course: { isActive: true },
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
    ...materials.map((material) => ({
      id: material.id,
      type: "material" as const,
      title: material.title,
      detail: `${material.courseSession.title} - ${material.fileName}`,
      courseId: material.courseSession.course.id,
      courseName: material.courseSession.course.title,
      createdAt: material.createdAt.toISOString(),
    })),
    ...sessions.map((session) => ({
      id: session.id,
      type: "session" as const,
      title: session.title,
      detail: "Sesi baru tersedia",
      courseId: session.course.id,
      courseName: session.course.title,
      createdAt: session.createdAt.toISOString(),
    })),
  ];

  return activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}
