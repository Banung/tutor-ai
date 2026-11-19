import { z } from "zod/v4";

const sourceRangeSchema = z.strictObject({
  materialId: z.string().min(1),
  startPage: z.number().int().min(1),
  endPage: z.number().int().min(1),
}).refine((range) => range.endPage >= range.startPage, "Rentang halaman tidak valid.");

const alignmentCaseFields = {
  question: z.string().trim().min(3).max(1000),
  referenceAnswer: z.string().trim().min(3).max(2000),
  rubric: z.string().trim().max(1000).optional().nullable(),
};

export const alignmentSessionSchema = z.strictObject({
  mode: z.enum(["ai", "manual"]),
  materialIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  thresholdPercent: z.number().int().min(1).max(100).default(90),
  academicLevel: z.enum(["S1", "S2", "S3"]).default("S1"),
  responseMode: z.enum(["chat", "avatar"]).default("chat"),
});

export const alignmentManualCaseSchema = z.strictObject({
  ...alignmentCaseFields,
  sourceRanges: z.array(sourceRangeSchema).max(10).default([]),
});

export const alignmentCaseUpdateSchema = z.strictObject({
  question: alignmentCaseFields.question.optional(),
  referenceAnswer: alignmentCaseFields.referenceAnswer.optional(),
  rubric: alignmentCaseFields.rubric,
  isApproved: z.boolean().optional(),
  selected: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "Tidak ada perubahan.");

export const alignmentSettingsSchema = z.strictObject({
  autoRerun: z.boolean(),
});

export const generatedAlignmentCasesSchema = z.strictObject({
  cases: z.array(z.strictObject({
    question: alignmentCaseFields.question,
    referenceAnswer: alignmentCaseFields.referenceAnswer,
    rubric: z.string().trim().min(3).max(1000),
    sources: z.array(z.strictObject({
      materialId: z.string().min(1),
      pageNumber: z.number().int().min(1),
    })).min(1).max(5),
  })).length(10),
});

export const alignmentScoreSchema = z.strictObject({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  grounded: z.boolean(),
  reason: z.string().trim().min(3).max(600),
});

export const alignmentCaseCorrectionSchema = z.strictObject({
  answer: z.string().trim().min(10).max(2000),
  rationale: z.string().trim().min(3).max(1000).default("Perbaikan dari hasil penyelarasan Tutor."),
});

export type AlignmentSourceRange = z.infer<typeof sourceRangeSchema>;
export type AlignmentScore = z.infer<typeof alignmentScoreSchema>;
