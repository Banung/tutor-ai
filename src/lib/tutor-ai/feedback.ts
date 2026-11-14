import type { Prisma } from "@/app/generated/prisma/client";
import { feedbackTransaction } from "./feedback-transaction";
import { nextFeedbackReviewStatus } from "./feedback-review-policy";
import prisma from "@/lib/prisma";
import { TutorAiServiceError } from "./service";
import { tutorFeedbackSchema } from "./feedback-schema";

type FeedbackScope = { userId: string; courseId: string; sessionId: string; messageId: string };

async function requireOwnedAnswer(scope: FeedbackScope, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({ where: { id: scope.userId }, select: { role: true } });
  if (user?.role !== "mahasiswa") throw new TutorAiServiceError("Feedback hanya tersedia untuk mahasiswa.", 403);
  const message = await db.aiChatMessage.findFirst({ where: {
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
  return feedbackTransaction(async (tx) => {
    await requireOwnedAnswer(scope, tx);
    const key = { userId_messageId: { userId: scope.userId, messageId: scope.messageId } };
    const previous = await tx.aiMessageFeedback.findUnique({ where: key });
    const next = { value: parsed.data.value, reason: parsed.data.reason ?? null, note: parsed.data.note || null };
    if (previous && previous.value === next.value && previous.reason === next.reason && previous.note === next.note) return previous;
    const run = await tx.aiResponseRun.findFirst({ where: {
      aiChatSessionId: scope.sessionId, answerMessageId: scope.messageId, status: "completed",
    }, select: { id: true } });
    const data = { ...next, runId: run?.id ?? null, reviewStatus: nextFeedbackReviewStatus(next.value), reviewerId: null, reviewedAt: null };
    const feedback = await tx.aiMessageFeedback.upsert({
      where: key,
      create: { userId: scope.userId, messageId: scope.messageId, ...data },
      update: { ...data, reviewRevision: { increment: 1 } },
    });
    await tx.aiFeedbackReviewEvent.create({ data: {
      feedbackId: feedback.id, revision: feedback.reviewRevision,
      eventType: previous ? "feedback_changed" : "feedback_submitted",
      fromStatus: previous?.reviewStatus ?? null, toStatus: feedback.reviewStatus,
      actorId: scope.userId, actorRole: "mahasiswa",
      ...(previous ? { feedbackBefore: { value: previous.value, reason: previous.reason, note: previous.note } } : {}),
      feedbackAfter: next,
    } });
    return feedback;
  });
}
