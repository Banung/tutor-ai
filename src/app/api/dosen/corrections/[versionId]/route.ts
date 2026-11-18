import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import { actOnCorrection } from "@/lib/tutor-ai/corrections";
import { feedbackReviewError, privateReviewHeaders } from "@/lib/tutor-ai/feedback-review-route";
export async function PATCH(request: NextRequest, context: { params: Promise<{ versionId: string }> }) {
  const { session, error } = await requireDosen(request); if (error) return error;
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({ error: "Tindakan tidak valid." }, { status: 400 }); }
  try { const { versionId } = await context.params; return NextResponse.json(await actOnCorrection(session.user.id, versionId, payload, request.signal), { headers: privateReviewHeaders }); }
  catch (error) { return feedbackReviewError(error); }
}
