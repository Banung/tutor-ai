import { NextResponse } from "next/server";
import { TutorAiServiceError } from "./service";

export function feedbackReviewError(error: unknown) {
  if (error instanceof TutorAiServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Feedback review request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Review feedback belum dapat diproses. Silakan coba lagi." }, { status: 500 });
}

export const privateReviewHeaders = { "Cache-Control": "private, no-store" };
