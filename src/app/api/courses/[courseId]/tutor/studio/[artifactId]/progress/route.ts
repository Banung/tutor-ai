import { NextRequest, NextResponse } from "next/server";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";
import { saveTutorStudioProgress } from "@/lib/tutor-ai/studio";
import { updateTutorStudioProgressSchema } from "@/lib/tutor-ai/studio-interactive";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; artifactId: string }> }
) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId, artifactId } = await context.params;
    const rawBody = await request.json().catch(() => null);
    const parsed = updateTutorStudioProgressSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data progres Studio tidak valid." },
        { status: 400 }
      );
    }

    const artifact = await saveTutorStudioProgress({
      courseId,
      userId,
      artifactId,
      payload: parsed.data,
    });
    return NextResponse.json({ artifact });
  } catch (err) {
    return tutorErrorResponse(err, "Gagal menyimpan progres Studio.");
  }
}
