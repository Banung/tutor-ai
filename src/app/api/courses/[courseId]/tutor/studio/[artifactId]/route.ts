import { NextRequest, NextResponse } from "next/server";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";
import {
  deleteTutorStudioArtifact,
  getTutorStudioArtifact,
  renameTutorStudioArtifact,
} from "@/lib/tutor-ai/studio";
import { renameTutorStudioArtifactSchema } from "@/lib/tutor-ai/studio-schema";

export async function GET(
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
    const artifact = await getTutorStudioArtifact({ courseId, userId, artifactId });
    return NextResponse.json({ artifact });
  } catch (err) {
    return tutorErrorResponse(err, "Gagal membaca artefak Studio.");
  }
}

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
    const parsed = renameTutorStudioArtifactSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Judul artefak tidak valid." },
        { status: 400 }
      );
    }

    const artifact = await renameTutorStudioArtifact({
      courseId,
      userId,
      artifactId,
      title: parsed.data.title,
    });
    return NextResponse.json({ artifact });
  } catch (err) {
    return tutorErrorResponse(err, "Gagal mengubah judul artefak Studio.");
  }
}

export async function DELETE(
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
    const result = await deleteTutorStudioArtifact({
      courseId,
      userId,
      artifactId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return tutorErrorResponse(err, "Gagal menghapus artefak Studio.");
  }
}
