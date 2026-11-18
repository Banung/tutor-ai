import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { TutorAiServiceError } from "./service";
import { feedbackTransaction } from "./feedback-transaction";
import { reviewActions, validateReviewChange } from "./feedback-review-policy";
import { reviewChangeSchema, reviewQueueSchema } from "./feedback-review-schema";

const PAGE_SIZE = 20;
const reviewerSelect = { id: true, name: true } satisfies Prisma.UserSelect;

async function requireLecturer(userId: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
  if (user?.role !== "dosen") throw new TutorAiServiceError("Review feedback hanya tersedia untuk dosen.", 403);
  return user;
}

function assignedFeedback(userId: string, courseId?: string): Prisma.AiMessageFeedbackWhereInput {
  return { OR: [{ value: "negative" }, { reviewEvents: { some: { toStatus: { in: ["pending", "in_review", "completed"] } } } }], message: { senderType: "ai", aiChatSession: { course: {
    ...(courseId ? { id: courseId } : {}), instructors: { some: { userId } },
  } } } };
}

export async function listFeedbackReviews(userId: string, query: unknown) {
  const parsed = reviewQueueSchema.safeParse(query);
  if (!parsed.success) throw new TutorAiServiceError("Filter antrean tidak valid.", 400);
  await requireLecturer(userId);
  const { courseId, status, page } = parsed.data;
  const where: Prisma.AiMessageFeedbackWhereInput = {
    ...assignedFeedback(userId, courseId), value: "negative",
    ...(status === "all" ? {} : { reviewStatus: status }),
  };
  const [rows, total, courses] = await Promise.all([
    prisma.aiMessageFeedback.findMany({
      where, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, reason: true, note: true, updatedAt: true, reviewStatus: true, reviewRevision: true,
        reviewer: { select: reviewerSelect },
        message: { select: { content: true, aiChatSession: { select: { course: { select: { id: true, title: true } } } } } },
      },
    }),
    prisma.aiMessageFeedback.count({ where }),
    prisma.course.findMany({ where: { instructors: { some: { userId } } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return { items: rows.map(({ message, ...row }) => ({ ...row, note: row.note?.slice(0, 160) ?? null,
    answerPreview: message.content.slice(0, 180), course: message.aiChatSession.course,
  })), total, page, pageSize: PAGE_SIZE, courses };
}

export async function getFeedbackReview(userId: string, feedbackId: string) {
  await requireLecturer(userId);
  const feedback = await prisma.aiMessageFeedback.findFirst({
    where: { id: feedbackId, ...assignedFeedback(userId) },
    select: { id: true, value: true, reason: true, note: true, createdAt: true, updatedAt: true,
      reviewStatus: true, reviewRevision: true, reviewedAt: true, reviewer: { select: reviewerSelect }, reviewerId: true,
      run: { select: { id: true, userMessageId: true } },
      message: { select: { id: true, content: true, createdAt: true, ragSources: true, aiChatSessionId: true,
        aiChatSession: { select: { course: { select: { id: true, title: true } } } },
      } },
      reviewEvents: { orderBy: { revision: "desc" }, take: 100, select: {
        id: true, revision: true, eventType: true, fromStatus: true, toStatus: true, actorRole: true, actorName: true,
        feedbackBefore: true, feedbackAfter: true, createdAt: true,
      } },
    },
  });
  if (!feedback) throw new TutorAiServiceError("Feedback tidak ditemukan.", 404);
  // Only the reported answer's question is disclosed, never the full chat/history.
  const question = await prisma.aiChatMessage.findFirst({
    where: { senderType: "user", aiChatSessionId: feedback.message.aiChatSessionId,
      ...(feedback.run?.userMessageId ? { id: feedback.run.userMessageId } : { createdAt: { lte: feedback.message.createdAt } }),
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { content: true },
  });
  const { message, run, reviewerId, ...item } = feedback;
  const reviewerHasAccess = await reviewerStillAssigned(prisma, reviewerId, message.aiChatSession.course.id, userId);
  const actions = reviewActions({ ...item, reviewerId, reviewerHasAccess }, userId);
  return { ...item, runId: run?.id ?? null, question: question?.content ?? null,
    answer: message.content, sources: sourceSummaries(message.ragSources), course: message.aiChatSession.course,
    actions,
  };
}

function sourceSummaries(ragSources: Prisma.JsonValue | null) {
  if (!ragSources || typeof ragSources !== "object" || Array.isArray(ragSources)) return [];
  const sources = ragSources.sources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source) || typeof source.materialTitle !== "string" || typeof source.pageNumber !== "number") return [];
    return [{ title: source.materialTitle, pageNumber: source.pageNumber,
      snippet: typeof source.snippet === "string" ? source.snippet : null }];
  });
}

export async function changeFeedbackReview(userId: string, feedbackId: string, payload: unknown) {
  const parsed = reviewChangeSchema.safeParse(payload);
  if (!parsed.success) throw new TutorAiServiceError("Status dan revisi review tidak valid.", 400);
  await feedbackTransaction(async (tx) => {
    const lecturer = await requireLecturer(userId, tx);
    const item = await tx.aiMessageFeedback.findFirst({
      where: { id: feedbackId, ...assignedFeedback(userId) },
      include: { message: { select: { aiChatSession: { select: { courseId: true } } } } },
    });
    if (!item) throw new TutorAiServiceError("Feedback tidak ditemukan.", 404);
    const reviewerHasAccess = await reviewerStillAssigned(tx, item.reviewerId, item.message.aiChatSession.courseId, userId);
    const status = validateReviewChange({ ...item, reviewerHasAccess }, userId, parsed.data);
    const updated = await tx.aiMessageFeedback.updateMany({
      where: { id: item.id, reviewRevision: parsed.data.expectedRevision, value: "negative", ...assignedFeedback(userId) },
      data: { reviewStatus: status, reviewRevision: { increment: 1 }, reviewerId: status === "pending" ? null : userId,
        reviewedAt: status === "completed" ? new Date() : null },
    });
    if (updated.count !== 1) throw new TutorAiServiceError("Feedback sudah berubah. Muat ulang detail.", 409);
    await tx.aiFeedbackReviewEvent.create({ data: {
      feedbackId, revision: item.reviewRevision + 1, eventType: "status_changed",
      fromStatus: item.reviewStatus, toStatus: status, actorId: userId, actorRole: "dosen", actorName: lecturer.name,
      feedbackBefore: { value: item.value, reason: item.reason, note: item.note },
    } });
  });
  return getFeedbackReview(userId, feedbackId);
}


async function reviewerStillAssigned(db: Prisma.TransactionClient, reviewerId: string | null, courseId: string, currentLecturerId: string) {
  if (!reviewerId || reviewerId === currentLecturerId) return true;
  return await db.courseInstructor.count({ where: { courseId, userId: reviewerId, user: { role: "dosen" } } }) > 0;
}
