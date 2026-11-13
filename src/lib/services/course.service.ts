import prisma from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type {
  AdminCreateCourseInput,
  CatalogStatusInput,
  UpdateCourseInput,
} from "@/lib/schemas/course.schema";
import {
  generateCourseCover,
  isCurrentCourseCover,
  isCustomCourseCover,
} from "@/lib/course-cover";
import { validateCourseCoverUpload } from "@/lib/course-cover-upload";
import { assertStudyProgramExists } from "@/lib/services/academic.service";
import {
  deleteCourseCoverFromSupabase,
  deleteMaterialFilesFromSupabase,
  uploadCourseCoverToSupabase,
} from "@/lib/supabase-storage";

export type PublicationMissingField = { field: string; message: string };

export class CourseServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly missingFields?: PublicationMissingField[]
  ) {
    super(message);
    this.name = "CourseServiceError";
  }
}

export const PUBLICATION_INCOMPLETE_MESSAGE =
  "Lengkapi data sebelum mempublikasikan entri.";

const COURSE_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/**
 * Operational definition of a publishable catalog entry.
 * Description, outcomes, custom cover, and AR availability stay optional.
 */
export function getCoursePublicationIssues(course: {
  title: string;
  courseCode: string | null;
  studyProgram: { id: string; facultyId: string } | null;
  instructorCount: number;
}): PublicationMissingField[] {
  const issues: PublicationMissingField[] = [];
  const title = course.title.trim();

  if (!title) {
    issues.push({ field: "title", message: "Nama mata kuliah wajib diisi." });
  } else if (title.length > 150) {
    issues.push({
      field: "title",
      message: "Nama mata kuliah maksimal 150 karakter.",
    });
  }

  if (!COURSE_CODE_PATTERN.test((course.courseCode ?? "").trim().toUpperCase())) {
    issues.push({
      field: "courseCode",
      message: "Format kode mata kuliah tidak valid.",
    });
  }

  if (!course.studyProgram?.id || !course.studyProgram.facultyId) {
    issues.push({
      field: "studyProgram",
      message: "Program studi dan fakultas wajib dipilih.",
    });
  }

  if (course.instructorCount < 1) {
    issues.push({
      field: "instructors",
      message: "Tambahkan minimal satu dosen pengampu.",
    });
  }

  return issues;
}

const publicationSelect = {
  id: true,
  title: true,
  courseCode: true,
  isActive: true,
  catalogStatus: true,
  studyProgram: { select: { id: true, facultyId: true } },
  _count: { select: { instructors: true } },
} as const;

type PublicationCourse = {
  id: string;
  title: string;
  courseCode: string | null;
  isActive: boolean;
  catalogStatus: CatalogStatusInput;
  studyProgram: { id: string; facultyId: string } | null;
  _count: { instructors: number };
};

/** Row-lock convention shared with instructor removal and FR-002 publication. */
async function lockCourseRow(tx: Prisma.TransactionClient, courseId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "course" WHERE "id" = ${courseId} FOR UPDATE
  `;
  return rows.length > 0;
}

function assertPublicationComplete(course: PublicationCourse, message: string) {
  const issues = getCoursePublicationIssues({
    title: course.title,
    courseCode: course.courseCode,
    studyProgram: course.studyProgram,
    instructorCount: course._count.instructors,
  });

  if (issues.length > 0) {
    throw new CourseServiceError(message, 400, issues);
  }
}

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

function generateEnrollmentKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
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

export async function listCourses(filters: {
  search?: string;
  facultyId?: string;
  studyProgramId?: string;
  catalogStatus?: CatalogStatusInput;
} = {}) {
  const { search, facultyId, studyProgramId, catalogStatus } = filters;
  const courses = await prisma.course.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { courseCode: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { enrollmentKey: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(studyProgramId && { studyProgramId }),
      ...(facultyId && { studyProgram: { facultyId } }),
      ...(catalogStatus && { catalogStatus }),
    },
    include: {
      creator: { select: { id: true, name: true } },
      studyProgram: {
        select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
      },
      _count: {
        select: {
          instructors: true,
          enrollments: true,
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ensureCourseCovers(courses);
}

export async function getCourseById(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      studyProgram: {
        select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
      },
      instructors: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: { enrollments: true, sessions: true },
      },
    },
  });

  if (!course) return null;
  return ensureCourseCover(course);
}

export async function createCourse(data: AdminCreateCourseInput, adminId: string) {
  if (data.studyProgramId) {
    await assertStudyProgramExists(data.studyProgramId);
  }

  // Generate unique enrollment key with retry
  let enrollmentKey = generateEnrollmentKey();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.course.findUnique({ where: { enrollmentKey } });
    if (!existing) break;
    enrollmentKey = generateEnrollmentKey();
    attempts++;
  }

  const courseId = crypto.randomUUID();

  try {
    return await prisma.course.create({
      data: {
        id: courseId,
        createdBy: adminId,
        title: data.title,
        description: data.description ?? null,
        courseCode: data.courseCode,
        learningOutcomes: data.learningOutcomes ?? null,
        studyProgramId: data.studyProgramId ?? null,
        hasArModule: data.hasArModule ?? false,
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
        studyProgram: {
          select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
        },
        _count: { select: { instructors: true, enrollments: true, sessions: true } },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CourseServiceError(
        "Kode mata kuliah sudah digunakan pada program studi ini.",
        409
      );
    }
    throw error;
  }
}

export async function updateCourse(id: string, data: UpdateCourseInput) {
  if (data.studyProgramId) {
    await assertStudyProgramExists(data.studyProgramId);
  }

  return prisma.$transaction(async (tx) => {
    if (!(await lockCourseRow(tx, id))) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    const existing = await tx.course.findUnique({ where: { id } });
    if (!existing) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    if (existing.catalogStatus === "PUBLISHED") {
      const nextStudyProgramId =
        data.studyProgramId !== undefined
          ? data.studyProgramId
          : existing.studyProgramId;
      const nextStudyProgram = nextStudyProgramId
        ? await tx.studyProgram.findUnique({
            where: { id: nextStudyProgramId },
            select: { id: true, facultyId: true },
          })
        : null;
      const instructorCount = await tx.courseInstructor.count({
        where: { courseId: id },
      });

      const issues = getCoursePublicationIssues({
        title: data.title ?? existing.title,
        courseCode: data.courseCode ?? existing.courseCode,
        studyProgram: nextStudyProgram,
        instructorCount,
      });

      if (issues.length > 0) {
        throw new CourseServiceError(
          "Perubahan ini membuat data course yang dipublikasikan tidak lengkap.",
          400,
          issues
        );
      }
    }

    const nextTitle = data.title ?? existing.title;
    const regenerateCover =
      data.title !== undefined &&
      data.title !== existing.title &&
      !existing.coverStoragePath &&
      !isCustomCourseCover(existing.coverImage);

    try {
      return await tx.course.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.courseCode !== undefined && { courseCode: data.courseCode }),
          ...(data.learningOutcomes !== undefined && {
            learningOutcomes: data.learningOutcomes,
          }),
          ...(data.studyProgramId !== undefined && {
            studyProgramId: data.studyProgramId,
          }),
          ...(data.hasArModule !== undefined && { hasArModule: data.hasArModule }),
          ...(regenerateCover && {
            coverImage: generateCourseCover({
              id: existing.id,
              title: nextTitle,
              enrollmentKey: existing.enrollmentKey,
            }),
          }),
        },
        include: {
          creator: { select: { id: true, name: true } },
          studyProgram: {
            select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
          },
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new CourseServiceError(
          "Kode mata kuliah sudah digunakan pada program studi ini.",
          409
        );
      }
      throw error;
    }
  });
}

export async function setCoursePublication(
  courseId: string,
  action: "publish" | "unpublish",
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockCourseRow(tx, courseId))) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: publicationSelect,
    });
    if (!course) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    if (course.catalogStatus === "ARCHIVED") {
      throw new CourseServiceError(
        "Course yang diarsipkan tidak dapat diubah status publikasinya.",
        409
      );
    }

    if (action === "publish") {
      if (course.catalogStatus === "PUBLISHED") {
        return { catalogStatus: "PUBLISHED" as const, changed: false };
      }

      if (!course.isActive) {
        throw new CourseServiceError(
          "Aktifkan akses course sebelum mempublikasikan entri.",
          409
        );
      }

      assertPublicationComplete(course, PUBLICATION_INCOMPLETE_MESSAGE);

      await tx.course.update({
        where: { id: courseId },
        data: { catalogStatus: "PUBLISHED" },
      });
      await tx.courseCatalogStatusLog.create({
        data: {
          id: crypto.randomUUID(),
          courseId,
          actorId,
          fromStatus: "DRAFT",
          toStatus: "PUBLISHED",
        },
      });

      return { catalogStatus: "PUBLISHED" as const, changed: true };
    }

    if (course.catalogStatus === "DRAFT") {
      return { catalogStatus: "DRAFT" as const, changed: false };
    }

    await tx.course.update({
      where: { id: courseId },
      data: { catalogStatus: "DRAFT" },
    });
    await tx.courseCatalogStatusLog.create({
      data: {
        id: crypto.randomUUID(),
        courseId,
        actorId,
        fromStatus: "PUBLISHED",
        toStatus: "DRAFT",
      },
    });

    return { catalogStatus: "DRAFT" as const, changed: true };
  });
}

export async function archiveCourse(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockCourseRow(tx, id))) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    const existing = await tx.course.findUnique({
      where: { id },
      select: { catalogStatus: true },
    });
    if (!existing) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    if (existing.catalogStatus === "ARCHIVED") {
      return { success: true, catalogStatus: "ARCHIVED" as const, changed: false };
    }

    await tx.course.update({
      where: { id },
      data: { catalogStatus: "ARCHIVED" },
    });
    await tx.courseCatalogStatusLog.create({
      data: {
        id: crypto.randomUUID(),
        courseId: id,
        actorId,
        fromStatus: existing.catalogStatus,
        toStatus: "ARCHIVED",
      },
    });

    return { success: true, catalogStatus: "ARCHIVED" as const, changed: true };
  });
}

export async function uploadCourseCover(
  courseId: string,
  file: { size: number; buffer: Buffer }
) {
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, coverStoragePath: true },
  });
  if (!existing) {
    throw new CourseServiceError("Course tidak ditemukan", 404);
  }

  const validation = await validateCourseCoverUpload(file);
  if (validation.error || !validation.detected) {
    throw new CourseServiceError(validation.error ?? "Berkas gambar tidak valid.", 400);
  }

  const uploaded = await uploadCourseCoverToSupabase({
    buffer: file.buffer,
    contentType: validation.detected.contentType,
    extension: validation.detected.extension,
    courseId,
  });

  try {
    const course = await prisma.course.update({
      where: { id: courseId },
      data: {
        coverImage: uploaded.publicUrl,
        coverStoragePath: uploaded.storagePath,
      },
      select: { id: true, coverImage: true, coverStoragePath: true },
    });

    if (
      existing.coverStoragePath &&
      existing.coverStoragePath !== uploaded.storagePath
    ) {
      await deleteCourseCoverFromSupabase(existing.coverStoragePath).catch(() => undefined);
    }

    return course;
  } catch (error) {
    await deleteCourseCoverFromSupabase(uploaded.storagePath).catch(() => undefined);
    throw error;
  }
}

export async function deleteCourse(id: string) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Course tidak ditemukan");
  }

  const materials = await prisma.material.findMany({
    where: { courseSession: { courseId: id } },
    select: { storagePath: true },
  });

  await deleteMaterialFilesFromSupabase(materials.map((material) => material.storagePath));
  await prisma.course.delete({ where: { id } });
  return { success: true };
}

export async function assignInstructor(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    throw new CourseServiceError("Course tidak ditemukan", 404);
  }

  // Verify user is a dosen
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new CourseServiceError("User tidak ditemukan", 404);
  }
  if (user.role !== "dosen") {
    throw new CourseServiceError(
      "Hanya user dengan role dosen yang dapat ditugaskan sebagai pengajar",
      400
    );
  }

  // Check not already assigned
  const existing = await prisma.courseInstructor.findFirst({
    where: { courseId, userId },
  });
  if (existing) {
    throw new CourseServiceError("Dosen sudah ditugaskan ke course ini", 409);
  }

  try {
    return await prisma.courseInstructor.create({
      data: {
        id: crypto.randomUUID(),
        courseId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CourseServiceError("Dosen sudah ditugaskan ke course ini", 409);
    }
    throw error;
  }
}

export async function removeInstructor(courseId: string, userId: string) {
  // Locking convention: instructor membership changes take a row lock on the parent
  // course. FR-002 publication must acquire the same lock before its completeness check
  // and status transition so the two operations serialize.
  return prisma.$transaction(async (tx) => {
    const lockedCourse = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "course" WHERE "id" = ${courseId} FOR UPDATE
    `;
    if (lockedCourse.length === 0) {
      throw new CourseServiceError("Course tidak ditemukan", 404);
    }

    const existing = await tx.courseInstructor.findFirst({
      where: { courseId, userId },
    });
    if (!existing) {
      throw new CourseServiceError("Assignment tidak ditemukan", 404);
    }

    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: {
        catalogStatus: true,
        _count: { select: { instructors: true } },
      },
    });

    if (
      course?.catalogStatus === "PUBLISHED" &&
      course._count.instructors <= 1
    ) {
      throw new CourseServiceError(
        "Course yang dipublikasikan wajib memiliki minimal satu dosen pengampu.",
        409
      );
    }

    await tx.courseInstructor.delete({ where: { id: existing.id } });
    return { success: true };
  });
}

export async function listAdminCourseSessions(courseId: string) {
  const sessions = await prisma.courseSession.findMany({
    where: { courseId },
    include: {
      creator: { select: { id: true, name: true } },
      materials: {
        select: {
          ...materialSelect,
          processingLogs: {
            select: {
              id: true,
              status: true,
              message: true,
              error: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { materials: true } },
    },
    orderBy: { orderNumber: "asc" },
  });

  return serializeBigInt(sessions);
}

export async function createAdminCourseSession(
  courseId: string,
  adminId: string,
  data: { title: string; description?: string | null }
) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new Error("Course tidak ditemukan");

  const lastSession = await prisma.courseSession.findFirst({
    where: { courseId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  const session = await prisma.courseSession.create({
    data: {
      id: crypto.randomUUID(),
      courseId,
      createdBy: adminId,
      title: data.title,
      description: data.description ?? null,
      orderNumber: (lastSession?.orderNumber ?? 0) + 1,
    },
    include: {
      creator: { select: { id: true, name: true } },
      materials: { select: materialSelect },
      _count: { select: { materials: true } },
    },
  });

  return serializeBigInt(session);
}

export async function updateAdminCourseSession(
  courseId: string,
  sessionId: string,
  data: { title?: string; description?: string | null; isActive?: boolean }
) {
  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true },
  });
  if (!session) throw new Error("Sesi tidak ditemukan");

  return prisma.courseSession.update({
    where: { id: sessionId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function getAdminCourseSessionInCourse(courseId: string, sessionId: string) {
  return prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true, title: true },
  });
}

export async function deleteAdminCourseSession(courseId: string, sessionId: string) {
  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: {
      id: true,
      materials: { select: { storagePath: true } },
    },
  });
  if (!session) throw new Error("Sesi tidak ditemukan");

  await deleteMaterialFilesFromSupabase(
    session.materials.map((material) => material.storagePath)
  );
  await prisma.courseSession.delete({ where: { id: sessionId } });
  return { success: true };
}

export async function createAdminMaterial(
  courseId: string,
  sessionId: string,
  adminId: string,
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
  const session = await prisma.courseSession.findFirst({
    where: { id: sessionId, courseId },
    select: { id: true },
  });
  if (!session) throw new Error("Sesi tidak ditemukan");

  const material = await prisma.material.create({
    data: {
      id: crypto.randomUUID(),
      courseSessionId: sessionId,
      uploadedBy: adminId,
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

export async function updateAdminMaterial(
  courseId: string,
  sessionId: string,
  materialId: string,
  data: {
    title?: string;
    description?: string | null;
    isActive?: boolean;
    externalUrl?: string | null;
    textContent?: string | null;
  }
) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, courseSessionId: sessionId, courseSession: { courseId } },
    select: { id: true, materialType: true },
  });
  if (!material) throw new Error("Materi tidak ditemukan");

  const updated = await prisma.material.update({
    where: { id: materialId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.externalUrl !== undefined &&
        material.materialType === "link" && {
          externalUrl: data.externalUrl,
          filePath: data.externalUrl ?? "",
        }),
      ...(data.textContent !== undefined &&
        material.materialType === "text" && {
          textContent: data.textContent,
          filePath: "",
          fileSize: BigInt(Buffer.byteLength(data.textContent ?? "", "utf8")),
        }),
    },
    select: materialSelect,
  });

  return serializeBigInt(updated);
}

export async function deleteAdminMaterial(
  courseId: string,
  sessionId: string,
  materialId: string
) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, courseSessionId: sessionId, courseSession: { courseId } },
    select: { id: true, storagePath: true },
  });
  if (!material) throw new Error("Materi tidak ditemukan");

  await deleteMaterialFilesFromSupabase([material.storagePath]);
  await prisma.material.delete({ where: { id: materialId } });
  return { success: true };
}

export async function getEnrollmentsByCourse(courseId: string) {
  return prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          npm: true,
          academicLevel: true,
          major: true,
          faculty: true,
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function getCourseStats() {
  const [totalCourses, activeCourses, totalEnrollments] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { isActive: true } }),
    prisma.enrollment.count(),
  ]);

  return { totalCourses, activeCourses, totalEnrollments };
}

export async function getDosenList() {
  return prisma.user.findMany({
    where: { role: "dosen" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function getMahasiswaList() {
  return prisma.user.findMany({
    where: { role: "mahasiswa" },
    select: { id: true, name: true, email: true, npm: true, major: true },
    orderBy: { name: "asc" },
  });
}

export async function enrollStudent(courseId: string, userId: string) {
  // Verify course exists
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw new Error("Course tidak ditemukan");
  }

  // Verify user is a mahasiswa
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User tidak ditemukan");
  }
  if (user.role !== "mahasiswa") {
    throw new Error("Hanya user dengan role mahasiswa yang dapat didaftarkan");
  }

  // Check not already enrolled
  const existing = await prisma.enrollment.findFirst({
    where: { courseId, userId },
  });
  if (existing) {
    throw new Error("Mahasiswa sudah terdaftar di course ini");
  }

  return prisma.enrollment.create({
    data: {
      id: crypto.randomUUID(),
      courseId,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          npm: true,
          academicLevel: true,
          major: true,
          faculty: true,
        },
      },
    },
  });
}

export async function removeEnrollment(courseId: string, userId: string) {
  const existing = await prisma.enrollment.findFirst({
    where: { courseId, userId },
  });
  if (!existing) {
    throw new Error("Enrollment tidak ditemukan");
  }

  await prisma.enrollment.delete({ where: { id: existing.id } });
  return { success: true };
}
