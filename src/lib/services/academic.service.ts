import prisma from "@/lib/prisma";

export class AcademicReferenceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AcademicReferenceError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

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

export async function listStudyPrograms(facultyId?: string) {
  return prisma.studyProgram.findMany({
    where: facultyId ? { facultyId } : {},
    include: { faculty: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createStudyProgram(facultyId: string, name: string) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    select: { id: true },
  });
  if (!faculty) {
    throw new AcademicReferenceError("Fakultas tidak ditemukan.", 404);
  }

  try {
    return await prisma.studyProgram.create({
      data: { id: crypto.randomUUID(), facultyId, name: name.trim() },
      include: { faculty: { select: { id: true, name: true } } },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AcademicReferenceError(
        "Program studi dengan nama tersebut sudah ada pada fakultas ini.",
        409
      );
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
