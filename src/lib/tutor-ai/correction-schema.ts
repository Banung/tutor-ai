import { z } from "zod/v4";

export const correctionDraftSchema = z.strictObject({
  question: z.string().trim().min(3).max(1000).regex(/[\p{L}\p{N}]/u),
  answer: z.string().trim().min(10).max(2000),
  rationale: z.string().trim().min(3).max(1000),
  sourceChunkIds: z.array(z.string().min(1)).min(1).max(5).refine((ids) => new Set(ids).size === ids.length),
});
export const correctionActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve"), expectedActiveVersionId: z.string().nullable() }),
  z.strictObject({ action: z.literal("withdraw"), expectedActiveVersionId: z.string(), reason: z.string().trim().min(3).max(500) }),
]);
export const correctionSourceSchema = z.object({
  chunkId: z.string(), sessionId: z.string(), materialId: z.string(), pageNumber: z.number().int(), chunkIndex: z.number().int(), content: z.string(),
  materialTitle: z.string(), fileName: z.string(), sessionTitle: z.string(), materialFingerprint: z.string(),
});
export const correctionSourcesSchema = z.array(correctionSourceSchema).min(1).max(5);
export type CorrectionSource = z.infer<typeof correctionSourceSchema>;
export const correctionStatusLabels: Record<string, string> = {
  draft: "Draft", approved: "Disetujui", withdrawn: "Dicabut", superseded: "Digantikan", needs_review: "Sumber perlu ditinjau ulang",
};
