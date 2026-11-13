import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { assignInstructorSchema } from "@/lib/schemas/course.schema";
import * as courseService from "@/lib/services/course.service";

function toErrorResponse(err: unknown, scope: string) {
  if (err instanceof courseService.CourseServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  logUnexpectedError(scope, err);
  return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id: courseId } = await context.params;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = assignInstructorSchema.safeParse(body.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const instructor = await courseService.assignInstructor(courseId, result.data.userId);
    return NextResponse.json(instructor, { status: 201 });
  } catch (err) {
    return toErrorResponse(err, "admin.courses.instructors.assign");
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
    return toErrorResponse(err, "admin.courses.instructors.remove");
  }
}
