import { NextRequest, NextResponse } from "next/server";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";
import {
  generateTutorStudioArtifact,
  listTutorStudioArtifacts,
  saveMessageToStudioNote,
} from "@/lib/tutor-ai/studio";
import {
  createTutorStudioArtifactSchema,
  listTutorStudioQuerySchema,
} from "@/lib/tutor-ai/studio-schema";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId } = await context.params;
    const url = new URL(request.url);
    const parsedQuery = listTutorStudioQuerySchema.safeParse({
      scope: url.searchParams.get("scope") ?? undefined,
      chatSessionId: url.searchParams.get("chatSessionId") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: parsedQuery.error.issues[0]?.message ?? "Parameter query Studio tidak valid." },
        { status: 400 }
      );
    }

    const artifacts = await listTutorStudioArtifacts({
      courseId,
      userId,
      scope: parsedQuery.data.scope,
      chatSessionId: parsedQuery.data.chatSessionId,
      type: parsedQuery.data.type,
    });

    return NextResponse.json({ artifacts });
  } catch (err) {
    return tutorErrorResponse(err, "Gagal memuat artefak Studio.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId } = await context.params;
    const rawBody = await request.json().catch(() => null);
    const parsed = createTutorStudioArtifactSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data Studio tidak valid." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "save_note") {
      const result = await saveMessageToStudioNote({
        courseId,
        userId,
        chatSessionId: parsed.data.chatSessionId,
        sourceMessageId: parsed.data.sourceMessageId,
        title: parsed.data.title,
        content: parsed.data.content,
        sources: parsed.data.sources,
      });
      return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
    }

    const result = await generateTutorStudioArtifact({
      courseId,
      userId,
      type: parsed.data.type,
      chatSessionId: parsed.data.chatSessionId,
      anchorMessageId: parsed.data.anchorMessageId,
      materialIds: parsed.data.materialIds,
      topic: parsed.data.topic,
      signal: request.signal,
    });

    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
  } catch (err) {
    return tutorErrorResponse(err, "Gagal membuat artefak Studio.");
  }
}
