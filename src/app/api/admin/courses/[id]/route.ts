import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { updateCourseSchema } from "@/lib/schemas/course.schema";
import * as courseService from "@/lib/services/course.service";
import { AcademicReferenceError } from "@/lib/services/academic.service";

function toErrorResponse(err: unknown) {
  if (err instanceof courseService.CourseServiceError) {
    return NextResponse.json(
      {
        error: err.message,
        ...(err.missingFields && { missingFields: err.missingFields }),
      },
      { status: err.status }
    );
  }
  if (err instanceof AcademicReferenceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  logUnexpectedError("admin.courses.item", err);
  return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const course = await courseService.getCourseById(id);

  if (!course) {
    return NextResponse.json({ error: "Course tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(course);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = updateCourseSchema.safeParse(body.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const course = await courseService.updateCourse(id, result.data);
    return NextResponse.json(course);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;

  return NextResponse.json(
    {
      error:
        "Penghapusan permanen dinonaktifkan. Gunakan aksi arsip untuk course ini.",
      action: "archive",
      courseId: id,
    },
    { status: 405, headers: { Allow: "GET, PATCH" } }
  );
}
