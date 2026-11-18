import { createHash } from "node:crypto";
import { TutorAiServiceError } from "./error";

export function correctionQuestionKey(question: string) {
  const normalized = question.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().replace(/\s+/g, " ");
  return fingerprint(normalized);
}
export function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function assertActiveVersion(actual: string | null, expected: string | null) {
  if (actual !== expected) throw new TutorAiServiceError("Versi aktif sudah berubah. Muat ulang dan tinjau versi yang akan digantikan.", 409);
}
