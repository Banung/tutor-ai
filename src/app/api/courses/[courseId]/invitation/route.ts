import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCourseInvitation } from "@/lib/services/course-invitation.service";
import type { RouteContext } from "@/lib/api-utils";

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "dosen") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { courseId } = await context.params;
    return NextResponse.json(await createCourseInvitation(courseId, session.user.id, role === "admin", request.nextUrl.origin));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal membuat undangan" }, { status: 404 });
  }
}
