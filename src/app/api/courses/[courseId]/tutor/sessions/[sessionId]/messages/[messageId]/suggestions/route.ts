import { NextRequest, NextResponse } from "next/server";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";
import { generateAndCacheMessageSuggestions } from "@/lib/tutor-ai/suggestions";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      courseId: string;
      sessionId: string;
      messageId: string;
    }>;
  }
) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId, sessionId, messageId } = await context.params;
    const result = await generateAndCacheMessageSuggestions({
      courseId,
      userId,
      sessionId,
      messageId,
      signal: request.signal,
    });
    return NextResponse.json(result);
  } catch (err) {
    return tutorErrorResponse(err, "Gagal menyusun saran tindak lanjut.");
  }
}
