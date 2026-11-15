import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { embedTutorQuestion, toPgVector } from "./gemini";
import { MATERIAL_EMBEDDING_MODEL, MATERIAL_EMBEDDING_DIMENSIONS } from "@/lib/material-processing/config";
import { TutorAiServiceError } from "./error";
import { getFeedbackReview } from "./feedback-review";
import { feedbackTransaction } from "./feedback-transaction";
import { assertActiveVersion, correctionQuestionKey, fingerprint } from "./correction-policy";
import { captureCorrectionSelections, correctionSourcesCurrent, eligibleCorrectionMaterial } from "./correction-sources";
import { correctionActionSchema, correctionDraftSchema } from "./correction-schema";
import { MAX_TUTOR_CONTEXT_CHUNKS } from "./retrieval-config";
import { z } from "zod/v4";

async function requireCorrectionLecturer(userId: string, courseId?: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
  if (user?.role !== "dosen") throw new TutorAiServiceError("Koreksi hanya dapat dikelola dosen pengampu.", 403);
  if (courseId && !await db.course.findFirst({ where: { id: courseId, instructors: { some: { userId } } }, select: { id: true } })) {
    throw new TutorAiServiceError("Koreksi tidak ditemukan.", 404);
  }
  return user;
}

async function presentVersions(rows: Awaited<ReturnType<typeof prisma.aiAnswerCorrection.findMany>>) {
  const sourceChecks = new Map<string, Promise<boolean>>();
  return Promise.all(rows.map(async (row) => {
    const active = await prisma.aiAnswerCorrection.findFirst({ where: { courseId: row.courseId, questionKey: row.questionKey, status: "approved" }, select: { id: true, version: true, answer: true } });
    const sourceKey = `${row.courseId}:${row.sourceFingerprint}`;
    if (!sourceChecks.has(sourceKey)) sourceChecks.set(sourceKey, correctionSourcesCurrent(row.courseId, row.sourceSnapshot));
    const sourceCurrent = await sourceChecks.get(sourceKey)!;
    return { ...row, sourceCurrent, effectiveStatus: ["draft", "approved"].includes(row.status) && !sourceCurrent ? "needs_review" : row.status,
      activeVersion: active };
  }));
}

const sourceQuerySchema = z.object({
  search: z.string().trim().max(100).default(""), page: z.coerce.number().int().min(1).max(10000).default(1),
  materialId: z.string().min(1).optional(),
  startPage: z.coerce.number().int().min(1).optional(), endPage: z.coerce.number().int().min(1).optional(),
}).superRefine((query, context) => {
  if ((query.startPage === undefined) !== (query.endPage === undefined)) context.addIssue({ code: "custom", message: "Rentang halaman harus berisi halaman awal dan akhir." });
  if (query.startPage !== undefined && query.endPage !== undefined && query.endPage < query.startPage) context.addIssue({ code: "custom", message: "Halaman akhir harus sesudah halaman awal." });
});

async function originalRunSuggestions(courseId: string, runId: string | null) {
  if (!runId) return [];
  const run = await prisma.aiResponseRun.findUnique({ where: { id: runId }, select: { evidence: true } });
  if (!Array.isArray(run?.evidence)) return [];
  const evidence = run.evidence.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    if (typeof value.chunkId !== "string" || typeof value.similarity !== "number") return [];
    return [{ chunkId: value.chunkId, similarity: value.similarity }];
  }).slice(0, MAX_TUTOR_CONTEXT_CHUNKS);
  if (!evidence.length) return [];
  const rows = await prisma.materialChunk.findMany({
    where: { id: { in: evidence.map((item) => item.chunkId) }, courseId, material: eligibleCorrectionMaterial },
    select: { id: true, pageNumber: true, chunkIndex: true, content: true, material: { select: { title: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return evidence.flatMap(({ chunkId, similarity }) => {
    const row = byId.get(chunkId);
    return row ? [{ id: row.id, title: row.material.title, pageNumber: row.pageNumber, chunkIndex: row.chunkIndex,
      snippet: row.content.slice(0, 300), content: row.content, similarity }] : [];
  });
}
export async function feedbackCorrections(userId: string, feedbackId: string, query: unknown = {}) {
  const parsed = sourceQuerySchema.safeParse(query);
  if (!parsed.success) throw new TutorAiServiceError("Filter sumber tidak valid.", 400);
  const context = await getFeedbackReview(userId, feedbackId);
  const courseId = context.course.id;
  const key = context.question ? correctionQuestionKey(context.question) : "";
  const sourceWhere: Prisma.MaterialChunkWhereInput = { courseId, material: eligibleCorrectionMaterial,
    ...(parsed.data.materialId ? { materialId: parsed.data.materialId } : {}),
    ...(parsed.data.startPage !== undefined && parsed.data.endPage !== undefined
      ? { pageNumber: { gte: parsed.data.startPage, lte: parsed.data.endPage } } : {}),
    ...(parsed.data.search ? { OR: [{ content: { contains: parsed.data.search, mode: "insensitive" } }, { material: { title: { contains: parsed.data.search, mode: "insensitive" } } }] } : {}),
  };
  const [rows, sources, totalSources, materials, suggestedSources] = await Promise.all([
    prisma.aiAnswerCorrection.findMany({ where: { courseId, OR: [{ feedbackId }, { questionKey: key }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.materialChunk.findMany({ where: sourceWhere, orderBy: [{ materialId: "asc" }, { chunkIndex: "asc" }], skip: (parsed.data.page - 1) * 10, take: 10,
      select: { id: true, pageNumber: true, chunkIndex: true, content: true, material: { select: { title: true } } } }),
    prisma.materialChunk.count({ where: sourceWhere }),
    prisma.material.findMany({ where: { courseId, ...eligibleCorrectionMaterial }, orderBy: { title: "asc" }, select: { id: true, title: true, pageCount: true } }),
    originalRunSuggestions(courseId, context.runId),
  ]);
  return { question: context.question ?? "", course: context.course, versions: await presentVersions(rows),
    sources: sources.map((s) => ({ id: s.id, title: s.material.title, pageNumber: s.pageNumber, chunkIndex: s.chunkIndex, snippet: s.content.slice(0, 300), content: s.content })),
    suggestedSources, materials: materials.map((material) => ({ id: material.id, title: material.title, pageCount: material.pageCount ?? 0 })),
    sourcePage: parsed.data.page, totalSources, sourcePageSize: 10 };
}

export async function createCorrectionDraft(userId: string, feedbackId: string, payload: unknown) {
  const parsed = correctionDraftSchema.safeParse(payload);
  if (!parsed.success) throw new TutorAiServiceError("Isi pertanyaan, koreksi 10–2000 karakter, alasan, dan pilih potongan atau rentang halaman yang valid.", 400);
  const context = await getFeedbackReview(userId, feedbackId);
  const courseId = context.course.id;
  const { sourceChunkIds, sourceRanges, ...content } = parsed.data;
  return feedbackTransaction(async (tx) => {
    const author = await requireCorrectionLecturer(userId, courseId, tx);
    const sources = await captureCorrectionSelections(courseId, sourceChunkIds, sourceRanges, tx);
    const questionKey = correctionQuestionKey(content.question);
    const previous = await tx.aiAnswerCorrection.findFirst({ where: { courseId, questionKey }, orderBy: { version: "desc" }, select: { version: true } });
    return tx.aiAnswerCorrection.create({ data: { ...content, courseId, feedbackId, questionKey,
      version: (previous?.version ?? 0) + 1, sourceSnapshot: sources, sourceFingerprint: fingerprint(sources),
      authorId: author.id, authorName: author.name } });
  });
}

export async function listCourseCorrections(userId: string, query: unknown = {}) {
  const parsed = z.object({ courseId: z.string().min(1).optional(), page: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse(query);
  if (!parsed.success) throw new TutorAiServiceError("Filter koreksi tidak valid.", 400);
  await requireCorrectionLecturer(userId, parsed.data.courseId);
  const where: Prisma.AiAnswerCorrectionWhereInput = { ...(parsed.data.courseId ? { courseId: parsed.data.courseId } : {}), course: { instructors: { some: { userId } } } };
  const [rows, total, courses] = await Promise.all([
    prisma.aiAnswerCorrection.findMany({ where, orderBy: { createdAt: "desc" }, take: 20, skip: (parsed.data.page - 1) * 20 }),
    prisma.aiAnswerCorrection.count({ where }),
    prisma.course.findMany({ where: { instructors: { some: { userId } } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return { versions: await presentVersions(rows), courses, total, page: parsed.data.page, pageSize: 20 };
}

export async function actOnCorrection(userId: string, versionId: string, payload: unknown, signal?: AbortSignal) {
  const parsed = correctionActionSchema.safeParse(payload);
  if (!parsed.success) throw new TutorAiServiceError("Tindakan koreksi tidak valid.", 400);
  const candidate = await prisma.aiAnswerCorrection.findFirst({ where: { id: versionId, course: { instructors: { some: { userId } } } } });
  await requireCorrectionLecturer(userId, candidate?.courseId);
  if (!candidate) throw new TutorAiServiceError("Koreksi tidak ditemukan.", 404);
  if (parsed.data.action === "approve" && candidate.status !== "draft") throw new TutorAiServiceError("Hanya draft yang dapat disetujui. Muat ulang untuk melihat versi aktif.", 409);
  if (!await correctionSourcesCurrent(candidate.courseId, candidate.sourceSnapshot) && parsed.data.action === "approve") throw new TutorAiServiceError("Sumber berubah atau tidak aktif. Buat versi baru dengan sumber terkini.", 409);
  const initialActive = await prisma.aiAnswerCorrection.findFirst({ where: { courseId: candidate.courseId, questionKey: candidate.questionKey, status: "approved" }, select: { id: true } });
  assertActiveVersion(initialActive?.id ?? null, parsed.data.expectedActiveVersionId);
  // Provider work happens before the transaction; a provider failure leaves the draft/active version untouched.
  const vector = parsed.data.action === "approve" ? toPgVector(await embedTutorQuestion(candidate.question, signal)) : null;
  return feedbackTransaction(async (tx) => {
    signal?.throwIfAborted();
    const actor = await requireCorrectionLecturer(userId, candidate.courseId, tx);
    const version = await tx.aiAnswerCorrection.findUnique({ where: { id: versionId } });
    if (!version) throw new TutorAiServiceError("Koreksi tidak ditemukan.", 404);
    const active = await tx.aiAnswerCorrection.findFirst({ where: { courseId: version.courseId, questionKey: version.questionKey, status: "approved" } });
    assertActiveVersion(active?.id ?? null, parsed.data.expectedActiveVersionId);
    if (parsed.data.action === "withdraw") {
      if (active?.id !== version.id) throw new TutorAiServiceError("Versi ini bukan koreksi aktif.", 409);
      return tx.aiAnswerCorrection.update({ where: { id: version.id }, data: { status: "withdrawn", withdrawnBy: actor.id, withdrawnByName: actor.name, withdrawnAt: new Date(), withdrawalReason: parsed.data.reason } });
    }
    if (version.status !== "draft" || !await correctionSourcesCurrent(version.courseId, version.sourceSnapshot, tx)) throw new TutorAiServiceError("Draft atau sumber berubah. Muat ulang dan buat versi baru bila diperlukan.", 409);
    if (active) await tx.aiAnswerCorrection.update({ where: { id: active.id }, data: { status: "superseded", supersededById: version.id } });
    const approved = await tx.aiAnswerCorrection.update({ where: { id: version.id }, data: {
      status: "approved", approvedBy: actor.id, approvedByName: actor.name, approvedAt: new Date(),
      embeddingModel: MATERIAL_EMBEDDING_MODEL, embeddingDimensions: MATERIAL_EMBEDDING_DIMENSIONS,
    } });
    await tx.$executeRaw`UPDATE "ai_answer_correction" SET "questionEmbedding" = ${vector}::vector WHERE "id" = ${version.id}`;
    signal?.throwIfAborted();
    return approved;
  });
}
