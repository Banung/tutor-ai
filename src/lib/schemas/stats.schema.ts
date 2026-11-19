import { z } from "zod/v4";

export const INVALID_DATE_RANGE_MESSAGE = "Rentang tanggal tidak valid.";

/** A `YYYY-MM-DD` string naming a real calendar day (UTC). */
function isRealDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().refine(isRealDateOnly, INVALID_DATE_RANGE_MESSAGE).optional()
);

const optionalStudyProgramIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1, "Program studi tidak valid.").optional()
);

export const statsFilterSchema = z
  .object({
    from: optionalDateSchema,
    to: optionalDateSchema,
    studyProgramId: optionalStudyProgramIdSchema,
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        message: INVALID_DATE_RANGE_MESSAGE,
        path: ["from"],
      });
    }
  });

export const statsExportQuerySchema = statsFilterSchema.extend({
  format: z.enum(["csv", "pdf"]),
});

export type StatsFilter = z.infer<typeof statsFilterSchema>;
export type StatsExportQuery = z.infer<typeof statsExportQuerySchema>;
