import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { assignInstructorSchema } from "@/lib/schemas/course.schema";
import * as courseService from "@/lib/services/course.service";

function toErrorResponse(err: unknown, fallback: string) {
  if (err instanceof courseService.CourseServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id: courseId } = await context.params;
  const body = await request.json();
  const result = assignInstructorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const instructor = await courseService.assignInstructor(courseId, result.data.userId);
    return NextResponse.json(instructor, { status: 201 });
  } catch (err) {
    return toErrorResponse(err, "Gagal menambahkan dosen");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id: courseId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId diperlukan" }, { status: 400 });
  }

  try {
    await courseService.removeInstructor(courseId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err, "Gagal menghapus dosen");
  }
}
