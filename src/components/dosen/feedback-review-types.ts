import type { ReviewAction } from "@/lib/tutor-ai/feedback-review-schema";

type Reviewer = { id: string; name: string } | null;
type Course = { id: string; title: string };
export type FeedbackReviewItem = {
  id: string; reason: string | null; note: string | null; updatedAt: string;
  reviewStatus: string; reviewRevision: number; reviewer: Reviewer; course: Course; answerPreview: string;
};
export type FeedbackQueue = {
  items: FeedbackReviewItem[]; total: number; page: number; pageSize: number; courses: Course[];
};
type FeedbackSnapshot = { value?: string; reason?: string | null; note?: string | null } | null;
export type FeedbackReviewDetail = Omit<FeedbackReviewItem, "answerPreview"> & {
  value: string; createdAt: string; reviewedAt: string | null; question: string | null; answer: string;
  runId: string | null; actions: ReviewAction[];
  sources: Array<{ title: string; pageNumber: number; snippet: string | null }>;
  reviewEvents: Array<{ id: string; revision: number; eventType: string; fromStatus: string | null; toStatus: string;
    actorRole: string; actorName: string | null; feedbackBefore: FeedbackSnapshot; feedbackAfter: FeedbackSnapshot; createdAt: string;
  }>;
};
