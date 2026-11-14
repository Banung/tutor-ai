import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import { getFeedbackReview, changeFeedbackReview } from "@/lib/tutor-ai/feedback-review";
import { feedbackReviewError, privateReviewHeaders } from "@/lib/tutor-ai/feedback-review-route";

type Context = { params: Promise<{ feedbackId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { session, error } = await requireDosen(request);
  if (error) return error;
  try {
    const { feedbackId } = await context.params;
    return NextResponse.json(await getFeedbackReview(session.user.id, feedbackId), { headers: privateReviewHeaders });
  } catch (error) {
    return feedbackReviewError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { session, error } = await requireDosen(request);
  if (error) return error;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan review tidak valid." }, { status: 400 });
  }
  try {
    const { feedbackId } = await context.params;
    const item = await changeFeedbackReview(session.user.id, feedbackId, payload);
    return NextResponse.json(item, { headers: privateReviewHeaders });
  } catch (error) {
    return feedbackReviewError(error);
  }
}
