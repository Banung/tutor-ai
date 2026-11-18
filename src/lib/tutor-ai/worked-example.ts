import { z } from "zod/v4";

const text = z.string().trim().min(1).max(2000);
export const workedExampleSchema = z.object({
  title: text,
  steps: z.array(z.object({ title: text, explanation: text }).strict()).min(1).max(8),
  result: text,
}).strict();

export function parseWorkedExample(value: string) {
  if (value.length > 20000) return null;
  try {
    const parsed = workedExampleSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
