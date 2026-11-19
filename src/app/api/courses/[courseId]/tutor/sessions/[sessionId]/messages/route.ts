import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { askTutorStream } from "@/lib/tutor-ai/service";
import { requireTutorUser, tutorErrorResponse } from "@/lib/tutor-ai/route-helpers";

type TutorMessagesRouteContext = {
  params: Promise<{ courseId: string; sessionId: string }>;
};

const messageSchema = z.object({
  content: z.string().trim().min(1, "Pertanyaan tidak boleh kosong").max(8000),
  requestId: z.uuid().optional(),
  retryOfRunId: z.uuid().optional(),
  responseMode: z.enum(["chat", "avatar"]).default("chat"),
  intent: z.enum(["chat", "summary"]).default("chat"),
  anchorMessageId: z.uuid().optional(),
}).superRefine((message, context) => {
  if (message.intent === "summary" && !message.anchorMessageId) {
    context.addIssue({
      code: "custom",
      path: ["anchorMessageId"],
      message: "Jawaban Tutor AI yang ingin diringkas harus dipilih.",
    });
  }
  if (message.intent === "summary" && message.responseMode !== "chat") {
    context.addIssue({
      code: "custom",
      path: ["responseMode"],
      message: "Ringkasan materi hanya tersedia di chat.",
    });
  }
});

export async function POST(request: NextRequest, context: TutorMessagesRouteContext) {
  const { userId, error } = await requireTutorUser(request);
  if (error) return error;

  const { courseId, sessionId } = await context.params;
  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    const stream = await askTutorStream({
      courseId,
      sessionId,
      userId: userId!,
      content: parsed.data.content,
      responseMode: parsed.data.responseMode,
      intent: parsed.data.intent,
      anchorMessageId: parsed.data.anchorMessageId,
      requestId: parsed.data.requestId,
      retryOfRunId: parsed.data.retryOfRunId,
      signal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return tutorErrorResponse(err, "Tutor AI gagal menjawab");
  }
}
