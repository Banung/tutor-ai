import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import { createStudyProgramSchema } from "@/lib/schemas/course.schema";
import {
  AcademicReferenceError,
  createStudyProgram,
  listStudyPrograms,
} from "@/lib/services/academic.service";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const facultyId = request.nextUrl.searchParams.get("facultyId") || undefined;
  return NextResponse.json(await listStudyPrograms(facultyId));
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = createStudyProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await createStudyProgram(parsed.data.facultyId, parsed.data.name),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AcademicReferenceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Gagal membuat program studi" }, { status: 500 });
  }
}
