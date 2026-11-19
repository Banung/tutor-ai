import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { MAX_COURSE_COVER_BYTES } from "@/lib/course-cover-upload";
import { CourseServiceError, uploadCourseCover } from "@/lib/services/course.service";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Berkas gambar wajib diunggah." }, { status: 400 });
  }

  if (file.size > MAX_COURSE_COVER_BYTES) {
    return NextResponse.json({ error: "Berkas gambar melebihi 2 MB." }, { status: 400 });
  }

  try {
    const cover = await uploadCourseCover(id, {
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(cover);
  } catch (err) {
    if (err instanceof CourseServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Gagal mengunggah cover" }, { status: 500 });
  }
}
