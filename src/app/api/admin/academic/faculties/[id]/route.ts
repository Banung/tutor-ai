import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { updateFacultySchema } from "@/lib/schemas/course.schema";
import {
  AcademicReferenceError,
  deleteFaculty,
  updateFaculty,
} from "@/lib/services/academic.service";

function toErrorResponse(scope: string, err: unknown) {
  if (err instanceof AcademicReferenceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  logUnexpectedError(scope, err);
  return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const parsed = updateFacultySchema.safeParse(body.data);
  if (!parsed.success) {
    const firstMessage =
      parsed.error.issues[0]?.message ?? "Data fakultas tidak valid.";
    return NextResponse.json(
      { error: firstMessage, issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const updated = await updateFaculty(id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return toErrorResponse("admin.academic.faculties.update", err);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;

  try {
    return NextResponse.json(await deleteFaculty(id));
  } catch (err) {
    return toErrorResponse("admin.academic.faculties.delete", err);
  }
}
