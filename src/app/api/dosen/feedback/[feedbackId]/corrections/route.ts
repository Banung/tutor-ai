import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import { feedbackCorrections, createCorrectionDraft } from "@/lib/tutor-ai/corrections";
import { feedbackReviewError, privateReviewHeaders } from "@/lib/tutor-ai/feedback-review-route";
type Context = { params: Promise<{ feedbackId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const { session, error } = await requireDosen(request); if (error) return error;
  try {
    const { feedbackId } = await context.params;
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await feedbackCorrections(session.user.id, feedbackId, {
      search: params.get("search") ?? undefined, page: params.get("page") ?? undefined,
      materialId: params.get("materialId") ?? undefined, startPage: params.get("startPage") ?? undefined,
      endPage: params.get("endPage") ?? undefined,
    }), { headers: privateReviewHeaders });
  }
  catch (error) { return feedbackReviewError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  const { session, error } = await requireDosen(request); if (error) return error;
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({ error: "Koreksi tidak valid." }, { status: 400 }); }
  try { const { feedbackId } = await context.params; return NextResponse.json(await createCorrectionDraft(session.user.id, feedbackId, payload), { status: 201, headers: privateReviewHeaders }); }
  catch (error) { return feedbackReviewError(error); }
}
