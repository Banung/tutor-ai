import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { MATERIAL_EMBEDDING_MODEL, MATERIAL_EMBEDDING_DIMENSIONS } from "@/lib/material-processing/config";
import { MAX_TUTOR_CONTEXT_CHUNKS, MIN_TUTOR_CONTEXT_SIMILARITY } from "./retrieval-config";
import { toPgVector } from "./gemini";
import { correctionQuestionKey } from "./correction-policy";
import { correctionSourcesSchema, type CorrectionSource } from "./correction-schema";
import { correctionSourcesCurrent } from "./correction-sources";
import { TutorAiServiceError } from "./error";

// Conservative initial settings; live paraphrase/unrelated-question evaluation is still required.
export const MIN_CORRECTION_SIMILARITY = 0.85;
const AMBIGUITY_MARGIN = 0.03;
type Candidate = { id: string; questionKey: string; question: string; answer: string; version: number;
  sourceSnapshot: Prisma.JsonValue; sourceFingerprint: string; similarity: number | string };
export type CorrectionContext = Omit<Candidate, "sourceSnapshot" | "similarity"> & { sourceSnapshot: CorrectionSource[]; similarity: number };

export function selectCorrectionContext(candidates: CorrectionContext[]) {
  const ranked = candidates.filter((c) => Number.isFinite(c.similarity) && c.similarity >= MIN_CORRECTION_SIMILARITY).sort((a, b) => b.similarity - a.similarity);
  const [best, second] = ranked;
  if (!best) return [];
  if (second && best.similarity - second.similarity < AMBIGUITY_MARGIN && best.answer.trim() !== second.answer.trim()) return [];
  return [best];
}

export async function findApplicableCorrections(input: { courseId: string; selectedMaterialIds: string[]; question: string; questionEmbedding: number[] }): Promise<CorrectionContext[]> {
  if (!input.selectedMaterialIds.length) return [];
  const vector = toPgVector(input.questionEmbedding);
  const key = correctionQuestionKey(input.question);
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT "id", "questionKey", "question", "answer", "version", "sourceSnapshot", "sourceFingerprint",
      CASE WHEN "questionKey" = ${key} THEN 1.0 ELSE (1 - ("questionEmbedding" <=> ${vector}::vector)) END AS "similarity"
    FROM "ai_answer_correction"
    WHERE "courseId" = ${input.courseId} AND "status" = 'approved'
      AND "embeddingModel" = ${MATERIAL_EMBEDDING_MODEL} AND "embeddingDimensions" = ${MATERIAL_EMBEDDING_DIMENSIONS}
      AND "questionEmbedding" IS NOT NULL
      AND ("questionKey" = ${key} OR (1 - ("questionEmbedding" <=> ${vector}::vector)) >= ${MIN_CORRECTION_SIMILARITY})
    ORDER BY "similarity" DESC, "id" ASC LIMIT 8
  `;
  const valid: CorrectionContext[] = [];
  for (const row of rows) {
    const sources = correctionSourcesSchema.safeParse(row.sourceSnapshot);
    if (!sources.success || !sources.data.every((s) => input.selectedMaterialIds.includes(s.materialId))) continue;
    if (!await correctionSourcesCurrent(input.courseId, sources.data)) continue;
    valid.push({ ...row, sourceSnapshot: sources.data, similarity: Number(row.similarity) });
  }
  return selectCorrectionContext(valid);
}

type CorrectionChunkRow = {
  chunkId: string; materialId: string; sessionId: string; pageNumber: number; chunkIndex: number; content: string;
  similarity: number | string; materialTitle: string; fileName: string; sessionTitle: string;
};

export async function correctionContextChunks(corrections: CorrectionContext[], input: {
  courseId: string; selectedMaterialIds: string[]; questionEmbedding: number[];
}): Promise<CorrectionChunkRow[]> {
  if (!corrections.length || !input.selectedMaterialIds.length) return [];
  const chunkIds = [...new Set(corrections.flatMap((correction) => correction.sourceSnapshot.flatMap((source) =>
    !("kind" in source) || source.kind === "chunk" ? [source.chunkId] : [])))];
  const pageRanges = corrections.flatMap((correction) => correction.sourceSnapshot.flatMap((source) =>
    "kind" in source && source.kind === "page_range" ? [source] : []));
  const sourceFilters: Prisma.Sql[] = [];
  if (chunkIds.length) sourceFilters.push(Prisma.sql`c."id" IN (${Prisma.join(chunkIds)})`);
  for (const range of pageRanges) sourceFilters.push(Prisma.sql`(c."materialId" = ${range.materialId} AND c."pageNumber" >= ${range.startPage} AND c."pageNumber" <= ${range.endPage})`);
  if (!sourceFilters.length) return [];
  const vector = toPgVector(input.questionEmbedding);
  return prisma.$queryRaw<CorrectionChunkRow[]>`
    SELECT c."id" AS "chunkId", c."materialId" AS "materialId", c."sessionId" AS "sessionId",
      c."pageNumber" AS "pageNumber", c."chunkIndex" AS "chunkIndex", c."content" AS "content",
      (1 - (c."embedding" <=> ${vector}::vector))::double precision AS "similarity",
      m."title" AS "materialTitle", m."fileName" AS "fileName", s."title" AS "sessionTitle"
    FROM "material_chunk" c
    INNER JOIN "material" m ON m."id" = c."materialId"
    INNER JOIN "course_session" s ON s."id" = c."sessionId"
    WHERE c."courseId" = ${input.courseId}
      AND c."embedding" IS NOT NULL
      AND m."isActive" = true AND m."isProcessed" = true AND m."processingStatus" = 'ready'
      AND m."materialType" = 'file' AND m."embeddingModel" = ${MATERIAL_EMBEDDING_MODEL}
      AND m."embeddingDimensions" = ${MATERIAL_EMBEDDING_DIMENSIONS} AND m."id" IN (${Prisma.join(input.selectedMaterialIds)})
      AND s."isActive" = true
      AND (${Prisma.join(sourceFilters, " OR ")})
      AND (1 - (c."embedding" <=> ${vector}::vector)) >= ${MIN_TUTOR_CONTEXT_SIMILARITY}
    ORDER BY c."embedding" <=> ${vector}::vector
    LIMIT ${MAX_TUTOR_CONTEXT_CHUNKS}
  `;
}

export async function assertCorrectionsCurrent(courseId: string, corrections: CorrectionContext[], db: Prisma.TransactionClient = prisma) {
  if (!corrections.length) return;
  const approved = await db.aiAnswerCorrection.findMany({ where: { id: { in: corrections.map((c) => c.id) }, courseId, status: "approved" }, select: { id: true } });
  if (approved.length !== corrections.length) throw new TutorAiServiceError("Koreksi dosen berubah saat jawaban diproses. Silakan coba lagi.", 409);
  for (const correction of corrections) {
    if (!await correctionSourcesCurrent(courseId, correction.sourceSnapshot, db)) throw new TutorAiServiceError("Sumber koreksi berubah saat jawaban diproses. Silakan coba lagi.", 409);
  }
}
