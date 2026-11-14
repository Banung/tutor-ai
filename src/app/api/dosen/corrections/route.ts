import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import { listCourseCorrections } from "@/lib/tutor-ai/corrections";
import { feedbackReviewError, privateReviewHeaders } from "@/lib/tutor-ai/feedback-review-route";
export async function GET(request: NextRequest) {
  const { session, error } = await requireDosen(request); if (error) return error;
  try { return NextResponse.json(await listCourseCorrections(session.user.id, { courseId: request.nextUrl.searchParams.get("courseId") ?? undefined, page: request.nextUrl.searchParams.get("page") ?? undefined }), { headers: privateReviewHeaders }); }
  catch (error) { return feedbackReviewError(error); }
}
