import { z } from "zod/v4";

export const correctionDraftSchema = z.strictObject({
  question: z.string().trim().min(3).max(1000).regex(/[\p{L}\p{N}]/u),
  answer: z.string().trim().min(10).max(2000),
  rationale: z.string().trim().min(3).max(1000),
  sourceChunkIds: z.array(z.string().min(1)).default([]).refine((ids) => new Set(ids).size === ids.length),
  sourceRanges: z.array(z.strictObject({
    materialId: z.string().min(1), startPage: z.number().int().min(1), endPage: z.number().int().min(1),
  }).refine((range) => range.endPage >= range.startPage, "Rentang halaman tidak valid.")).default([]),
}).superRefine((value, context) => {
  const ranges = new Set<string>();
  for (const range of value.sourceRanges) {
    const key = `${range.materialId}:${range.startPage}:${range.endPage}`;
    if (ranges.has(key)) context.addIssue({ code: "custom", path: ["sourceRanges"], message: "Rentang halaman tidak boleh duplikat." });
    ranges.add(key);
  }
});
export const correctionActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve"), expectedActiveVersionId: z.string().nullable() }),
  z.strictObject({ action: z.literal("withdraw"), expectedActiveVersionId: z.string(), reason: z.string().trim().min(3).max(500) }),
]);
const legacyCorrectionSourceSchema = z.object({
  chunkId: z.string(), sessionId: z.string(), materialId: z.string(), pageNumber: z.number().int(), chunkIndex: z.number().int(), content: z.string(),
  materialTitle: z.string(), fileName: z.string(), sessionTitle: z.string(), materialFingerprint: z.string(),
});

const correctionSourceMetadataSchema = z.strictObject({
  materialId: z.string(), sessionId: z.string(), materialTitle: z.string(), fileName: z.string(), sessionTitle: z.string(), materialFingerprint: z.string(),
});

const correctionChunkReferenceSchema = correctionSourceMetadataSchema.extend({
  kind: z.literal("chunk"), chunkId: z.string(), pageNumber: z.number().int(), chunkIndex: z.number().int(),
});

const correctionPageRangeSchema = correctionSourceMetadataSchema.extend({
  kind: z.literal("page_range"), startPage: z.number().int().min(1), endPage: z.number().int().min(1),
}).refine((range) => range.endPage >= range.startPage);

export const correctionSourceSchema = z.union([
  legacyCorrectionSourceSchema, correctionChunkReferenceSchema, correctionPageRangeSchema,
]);
export const correctionSourcesSchema = z.array(correctionSourceSchema);
export type CorrectionSource = z.infer<typeof correctionSourceSchema>;
export type CorrectionPageRangeInput = z.infer<typeof correctionDraftSchema>["sourceRanges"][number];
export type CorrectionPageRange = z.infer<typeof correctionPageRangeSchema>;
export const correctionStatusLabels: Record<string, string> = {
  draft: "Draft", approved: "Disetujui", withdrawn: "Dicabut", superseded: "Digantikan", needs_review: "Sumber perlu ditinjau ulang",
};
