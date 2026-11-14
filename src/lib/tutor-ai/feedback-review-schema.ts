import { z } from "zod/v4";

export const reviewStatusLabels = {
  pending: "Belum ditinjau",
  in_review: "Sedang ditinjau",
  completed: "Selesai ditinjau",
  withdrawn: "Ditarik mahasiswa",
} as const;
export type ReviewStatus = keyof typeof reviewStatusLabels;
export type ReviewAction = "pending" | "in_review" | "completed";

export const reviewChangeSchema = z.strictObject({
  status: z.enum(["pending", "in_review", "completed"]),
  expectedRevision: z.number().int().positive(),
});
export const reviewQueueSchema = z.object({
  courseId: z.string().min(1).max(200).optional(),
  status: z.enum(["all", "pending", "in_review", "completed"]).default("pending"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
