import { FeedbackReviewDetailPanel } from "@/components/dosen/feedback-review-detail";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <FeedbackReviewDetailPanel key={feedbackId} feedbackId={feedbackId} />;
}
