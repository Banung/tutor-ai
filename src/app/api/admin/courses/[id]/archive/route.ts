import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { logUnexpectedError } from "@/lib/api-errors";
import { archiveCourse, CourseServiceError } from "@/lib/services/course.service";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;

  try {
    const result = await archiveCourse(id, session!.user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CourseServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logUnexpectedError("admin.courses.archive", err);
    return NextResponse.json({ error: "Gagal mengarsipkan course" }, { status: 500 });
  }
}
