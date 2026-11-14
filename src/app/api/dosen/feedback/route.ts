import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import { listFeedbackReviews } from "@/lib/tutor-ai/feedback-review";
import { feedbackReviewError, privateReviewHeaders } from "@/lib/tutor-ai/feedback-review-route";

export async function GET(request: NextRequest) {
  const { session, error } = await requireDosen(request);
  if (error) return error;
  try {
    const params = request.nextUrl.searchParams;
    const queue = await listFeedbackReviews(session.user.id, {
      courseId: params.get("courseId") ?? undefined, status: params.get("status") ?? undefined, page: params.get("page") ?? undefined,
    });
    return NextResponse.json(queue, { headers: privateReviewHeaders });
  } catch (error) {
    return feedbackReviewError(error);
  }
}
