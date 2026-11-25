import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { UpdateStudyProgramInput } from "@/lib/schemas/course.schema";

export class AcademicReferenceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AcademicReferenceError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

function isForeignKeyConstraintError(error: unknown) {
  return (error as { code?: string })?.code === "P2003";
}

function isRecordNotFoundError(error: unknown) {
  return (error as { code?: string })?.code === "P2025";
}

function studyProgramConflictMessage(error: unknown) {
  const target = (error as { meta?: { target?: unknown } })?.meta?.target;
  const targetText = Array.isArray(target)
    ? target.map((item) => String(item)).join(",")
    : typeof target === "string"
      ? target
      : "";
  if (targetText.toLowerCase().includes("code")) {
    return "Kode program studi tersebut sudah digunakan pada fakultas ini.";
  }
  return "Program studi dengan nama tersebut sudah ada pada fakultas ini.";
}

const studyProgramInclude = {
  faculty: { select: { id: true, name: true, code: true } },
  _count: { select: { courses: true } },
} as const;

export async function listFaculties() {
  return prisma.faculty.findMany({
    include: {
      studyPrograms: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createFaculty(name: string) {
  try {
    return await prisma.faculty.create({
      data: { id: crypto.randomUUID(), name: name.trim() },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicReferenceError("Fakultas dengan nama tersebut sudah ada.", 409);
    }
    throw error;
  }
}

export async function listStudyPrograms(facultyId?: string, search?: string) {
  const trimmedFacultyId = facultyId?.trim();
  const trimmedSearch = search?.trim();

  const where: Prisma.StudyProgramWhereInput = {};
  if (trimmedFacultyId) {
    where.facultyId = trimmedFacultyId;
  }
  if (trimmedSearch) {
    where.OR = [
      { name: { contains: trimmedSearch, mode: "insensitive" } },
      { code: { contains: trimmedSearch, mode: "insensitive" } },
      { faculty: { name: { contains: trimmedSearch, mode: "insensitive" } } },
    ];
  }

  return prisma.studyProgram.findMany({
    where,
    include: studyProgramInclude,
    orderBy: [{ faculty: { name: "asc" } }, { name: "asc" }],
  });
}

export async function createStudyProgram(
  facultyId: string,
  name: string,
  code?: string | null
) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    select: { id: true },
  });
  if (!faculty) {
    throw new AcademicReferenceError("Fakultas tidak ditemukan.", 404);
  }

  try {
    return await prisma.studyProgram.create({
      data: {
        id: crypto.randomUUID(),
        facultyId,
        name: name.trim(),
        ...(code !== undefined && { code }),
      },
      include: studyProgramInclude,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicReferenceError(studyProgramConflictMessage(error), 409);
    }
    throw error;
  }
}

export async function updateStudyProgram(id: string, data: UpdateStudyProgramInput) {
  const existing = await prisma.studyProgram.findUnique({
    where: { id },
    select: { id: true, facultyId: true },
  });
  if (!existing) {
    throw new AcademicReferenceError("Program studi tidak ditemukan.", 404);
  }

  if (data.facultyId && data.facultyId !== existing.facultyId) {
    const faculty = await prisma.faculty.findUnique({
      where: { id: data.facultyId },
      select: { id: true },
    });
    if (!faculty) {
      throw new AcademicReferenceError("Fakultas tidak ditemukan.", 404);
    }
  }

  try {
    return await prisma.studyProgram.update({
      where: { id },
      data: {
        ...(data.facultyId !== undefined && { facultyId: data.facultyId }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code }),
      },
      include: studyProgramInclude,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicReferenceError(studyProgramConflictMessage(error), 409);
    }
    if (isRecordNotFoundError(error)) {
      throw new AcademicReferenceError("Program studi tidak ditemukan.", 404);
    }
    throw error;
  }
}

export async function deleteStudyProgram(id: string) {
  const existing = await prisma.studyProgram.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { courses: true, academicCourseReferences: true } },
    },
  });
  if (!existing) {
    throw new AcademicReferenceError("Program studi tidak ditemukan.", 404);
  }

  if (existing._count.courses > 0 || existing._count.academicCourseReferences > 0) {
    throw new AcademicReferenceError(
      "Program studi tidak dapat dihapus karena masih digunakan oleh mata kuliah atau referensi akademik.",
      409
    );
  }

  try {
    await prisma.studyProgram.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      throw new AcademicReferenceError(
        "Program studi tidak dapat dihapus karena masih digunakan oleh mata kuliah atau referensi akademik.",
        409
      );
    }
    if (isRecordNotFoundError(error)) {
      throw new AcademicReferenceError("Program studi tidak ditemukan.", 404);
    }
    throw error;
  }
}

export async function assertStudyProgramExists(studyProgramId: string) {
  const studyProgram = await prisma.studyProgram.findUnique({
    where: { id: studyProgramId },
    select: { id: true },
  });
  if (!studyProgram) {
    throw new AcademicReferenceError("Program studi tidak ditemukan.", 400);
  }
}
