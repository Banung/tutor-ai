import { z } from "zod/v4";

export const feedbackReasons = {
  incorrect: "Jawaban kurang tepat",
  unclear: "Penjelasan kurang jelas",
  sources: "Sumber kurang sesuai",
  other: "Lainnya",
} as const;

export const tutorFeedbackSchema = z.strictObject({
  value: z.enum(["positive", "negative"]),
  reason: z.enum(["incorrect", "unclear", "sources", "other"]).nullable().optional(),
  note: z.string().max(500).transform((value) => value.trim()).nullable().optional(),
});

export type TutorFeedbackValue = z.infer<typeof tutorFeedbackSchema>;
export type TutorFeedback = TutorFeedbackValue & {
  id: string;
  runId: string | null;
  updatedAt: string;
};
