import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { adminCreateCourseSchema, catalogStatusSchema } from "@/lib/schemas/course.schema";
import * as courseService from "@/lib/services/course.service";
import { AcademicReferenceError } from "@/lib/services/academic.service";

function toErrorResponse(err: unknown) {
  if (err instanceof courseService.CourseServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof AcademicReferenceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  logUnexpectedError("admin.courses", err);
  return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const catalogStatusParam = params.get("catalogStatus");
  const parsedStatus = catalogStatusParam
    ? catalogStatusSchema.safeParse(catalogStatusParam)
    : null;

  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json({ error: "Status katalog tidak valid" }, { status: 400 });
  }

  const courses = await courseService.listCourses({
    search: params.get("search") || undefined,
    facultyId: params.get("facultyId") || undefined,
    studyProgramId: params.get("studyProgramId") || undefined,
    catalogStatus: parsedStatus?.data,
  });
  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = adminCreateCourseSchema.safeParse(body.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const course = await courseService.createCourse(result.data, session!.user.id);
    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
