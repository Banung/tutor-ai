import { createHash, randomBytes, randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCourseInvitation(courseId: string, userId: string, isAdmin: boolean, origin: string) {
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isActive: true,
      ...(isAdmin ? {} : { instructors: { some: { userId } } }),
    },
    select: { id: true },
  });
  if (!course) throw new Error("Course tidak ditemukan atau Anda tidak memiliki akses");

  const token = randomBytes(32).toString("base64url");
  await prisma.courseInvitation.upsert({
    where: { courseId },
    create: { id: randomUUID(), courseId, tokenHash: hashToken(token) },
    update: { tokenHash: hashToken(token) },
  });
  return { url: `${origin}/invite/${token}` };
}

export async function getCourseInvitation(token: string) {
  const invitation = await prisma.courseInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { course: { select: { id: true, title: true, description: true, isActive: true } } },
  });
  if (!invitation?.course.isActive) return null;
  return { id: invitation.course.id, title: invitation.course.title, description: invitation.course.description };
}

export async function acceptCourseInvitation(token: string, mahasiswaId: string) {
  const invitation = await prisma.courseInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { course: { select: { id: true, title: true, isActive: true } } },
  });
  if (!invitation?.course.isActive) throw new Error("Link undangan tidak valid atau course sudah tidak aktif");

  const { id: courseId, title } = invitation.course;
  const existing = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: mahasiswaId } } });
  if (existing?.isActive) throw new Error("Anda sudah terdaftar di course ini");
  if (existing) {
    await prisma.enrollment.update({ where: { id: existing.id }, data: { isActive: true } });
  } else {
    await prisma.enrollment.create({ data: { id: randomUUID(), courseId, userId: mahasiswaId } });
  }
  return { success: true, courseId, courseTitle: title };
}
