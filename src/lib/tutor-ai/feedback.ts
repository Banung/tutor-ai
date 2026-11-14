import prisma from "@/lib/prisma";
import { TutorAiServiceError } from "./service";
import { tutorFeedbackSchema } from "./feedback-schema";

type FeedbackScope = { userId: string; courseId: string; sessionId: string; messageId: string };

async function requireOwnedAnswer(scope: FeedbackScope) {
  const user = await prisma.user.findUnique({ where: { id: scope.userId }, select: { role: true } });
  if (user?.role !== "mahasiswa") throw new TutorAiServiceError("Feedback hanya tersedia untuk mahasiswa.", 403);
  const message = await prisma.aiChatMessage.findFirst({ where: {
    id: scope.messageId,
    senderType: "ai",
    aiChatSessionId: scope.sessionId,
    aiChatSession: {
      userId: scope.userId, courseId: scope.courseId,
      course: { isActive: true, enrollments: { some: { userId: scope.userId, isActive: true } } },
    },
  }, select: { id: true } });
  if (!message) throw new TutorAiServiceError("Jawaban tidak ditemukan.", 404);
}

export async function readTutorFeedback(scope: FeedbackScope) {
  await requireOwnedAnswer(scope);
  return prisma.aiMessageFeedback.findUnique({ where: {
    userId_messageId: { userId: scope.userId, messageId: scope.messageId },
  } });
}

export async function saveTutorFeedback(scope: FeedbackScope, payload: unknown) {
  const parsed = tutorFeedbackSchema.safeParse(payload);
  if (!parsed.success) throw new TutorAiServiceError("Feedback tidak valid. Catatan maksimal 500 karakter.", 400);
  await requireOwnedAnswer(scope);
  const run = await prisma.aiResponseRun.findFirst({ where: {
    aiChatSessionId: scope.sessionId, answerMessageId: scope.messageId, status: "completed",
  }, select: { id: true } });
  const data = { value: parsed.data.value, reason: parsed.data.reason ?? null, note: parsed.data.note || null, runId: run?.id ?? null };
  return prisma.aiMessageFeedback.upsert({
    where: { userId_messageId: { userId: scope.userId, messageId: scope.messageId } },
    create: { userId: scope.userId, messageId: scope.messageId, ...data },
    update: data,
  });
}
