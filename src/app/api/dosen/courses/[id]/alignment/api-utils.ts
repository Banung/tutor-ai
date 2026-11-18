import { NextResponse } from "next/server";
import { TutorAiServiceError } from "@/lib/tutor-ai/error";

export const alignmentPrivateHeaders = { "Cache-Control": "private, no-store" };

export function alignmentErrorResponse(error: unknown) {
  if (error instanceof TutorAiServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: alignmentPrivateHeaders });
  }
  console.error("Tutor alignment API failed", error);
  return NextResponse.json({ error: "Penyelarasan Tutor gagal diproses." }, { status: 500, headers: alignmentPrivateHeaders });
}
