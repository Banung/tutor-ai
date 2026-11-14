import { TutorAiServiceError } from "./service";
import type { ReviewAction } from "./feedback-review-schema";

type ReviewState = { value: string; reviewStatus: string; reviewerId: string | null; reviewRevision: number; reviewerHasAccess?: boolean };

export function nextFeedbackReviewStatus(value: string) {
  return value === "negative" ? "pending" : "withdrawn";
}

export function reviewActions(item: ReviewState, lecturerId: string): ReviewAction[] {
  if (item.value !== "negative") return [];
  if (item.reviewStatus === "pending" || item.reviewStatus === "completed") return ["in_review"];
  if (item.reviewStatus === "in_review" && item.reviewerHasAccess === false) return ["pending"];
  if (item.reviewStatus === "in_review" && (item.reviewerId === lecturerId || item.reviewerId === null)) {
    return item.reviewerId === null ? ["pending"] : ["completed", "pending"];
  }
  return [];
}

export function validateReviewChange(item: ReviewState, lecturerId: string, change: { status: ReviewAction; expectedRevision: number }) {
  if (item.reviewRevision !== change.expectedRevision) {
    throw new TutorAiServiceError("Feedback atau review sudah berubah. Muat ulang detail sebelum melanjutkan.", 409);
  }
  if (item.value !== "negative") throw new TutorAiServiceError("Feedback sudah diubah menjadi positif dan ditarik dari antrean.", 409);
  if (item.reviewStatus === "in_review" && item.reviewerId && item.reviewerId !== lecturerId && item.reviewerHasAccess !== false) {
    throw new TutorAiServiceError("Feedback sedang ditinjau dosen lain.", 409);
  }
  if (!reviewActions(item, lecturerId).includes(change.status)) throw new TutorAiServiceError("Perubahan status review tidak valid.", 409);
  return change.status;
}
