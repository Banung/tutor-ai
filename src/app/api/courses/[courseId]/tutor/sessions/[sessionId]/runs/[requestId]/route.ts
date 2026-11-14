import { NextRequest, NextResponse } from "next/server";
import { getTutorResponseRun } from "@/lib/tutor-ai/service";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";

export async function GET(request: NextRequest, context: {
  params: Promise<{ courseId: string; sessionId: string; requestId: string }>;
}) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  try {
    const params = await context.params;
    const run = await getTutorResponseRun({ ...params, userId: userId! });
    return NextResponse.json(run, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tutorErrorResponse(error, "Gagal memuat run");
  }
}
