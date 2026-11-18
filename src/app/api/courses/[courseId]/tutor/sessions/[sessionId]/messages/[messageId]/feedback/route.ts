import { NextRequest, NextResponse } from "next/server";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";
import { readTutorFeedback, saveTutorFeedback } from "@/lib/tutor-ai/feedback";

type Context = { params: Promise<{ courseId: string; sessionId: string; messageId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  try {
    const scope = { ...await context.params, userId: userId! };
    return NextResponse.json(await readTutorFeedback(scope), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tutorErrorResponse(error, "Gagal memuat feedback");
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Feedback tidak valid" }, { status: 400 });
  }
  try {
    const scope = { ...await context.params, userId: userId! };
    return NextResponse.json(await saveTutorFeedback(scope, payload), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tutorErrorResponse(error, "Gagal menyimpan feedback");
  }
}
