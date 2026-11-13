import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { publicationActionSchema } from "@/lib/schemas/course.schema";
import {
  CourseServiceError,
  setCoursePublication,
} from "@/lib/services/course.service";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const parsed = publicationActionSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Aksi publikasi tidak valid" },
      { status: 400 }
    );
  }

  const { id } = await context.params;

  try {
    const result = await setCoursePublication(
      id,
      parsed.data.action,
      session!.user.id
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CourseServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          ...(err.missingFields && { missingFields: err.missingFields }),
        },
        { status: err.status }
      );
    }

    logUnexpectedError("admin.courses.publication", err);
    return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
  }
}
