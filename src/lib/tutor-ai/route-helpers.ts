import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { TutorAiServiceError } from "@/lib/tutor-ai/service";

export async function requireTutorUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user as { isFrozen?: boolean; isActive?: boolean };
  if (user.isFrozen === true || user.isActive === false) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: "Akun dibekukan atau tidak aktif." },
        { status: 403 }
      ),
    };
  }

  return { userId: session.user.id, error: null };
}

export function tutorErrorResponse(error: unknown, fallback: string) {
  if (error instanceof TutorAiServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}
