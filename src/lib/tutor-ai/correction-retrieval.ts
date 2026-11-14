import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { MATERIAL_EMBEDDING_MODEL, MATERIAL_EMBEDDING_DIMENSIONS } from "@/lib/material-processing/config";
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

export function correctionContextChunks(corrections: CorrectionContext[]) {
  return corrections.flatMap((correction) => correction.sourceSnapshot.map((source) => ({
    chunkId: source.chunkId, materialId: source.materialId, sessionId: source.sessionId, pageNumber: source.pageNumber,
    chunkIndex: source.chunkIndex, content: source.content, similarity: correction.similarity,
    materialTitle: source.materialTitle, fileName: source.fileName, sessionTitle: source.sessionTitle,
  })));
}

export async function assertCorrectionsCurrent(courseId: string, corrections: CorrectionContext[], db: Prisma.TransactionClient = prisma) {
  if (!corrections.length) return;
  const approved = await db.aiAnswerCorrection.findMany({ where: { id: { in: corrections.map((c) => c.id) }, courseId, status: "approved" }, select: { id: true } });
  if (approved.length !== corrections.length) throw new TutorAiServiceError("Koreksi dosen berubah saat jawaban diproses. Silakan coba lagi.", 409);
  for (const correction of corrections) {
    if (!await correctionSourcesCurrent(courseId, correction.sourceSnapshot, db)) throw new TutorAiServiceError("Sumber koreksi berubah saat jawaban diproses. Silakan coba lagi.", 409);
  }
}
