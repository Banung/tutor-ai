import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import { GENERIC_API_ERROR, logUnexpectedError } from "@/lib/api-errors";
import { MAX_FILE_BYTES } from "@/lib/academic-import/constants";
import { ImportFileError } from "@/lib/academic-import/file-parser";
import {
  AcademicImportError,
  isAcademicSource,
  isImportType,
  previewImport,
} from "@/lib/academic-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  try {
    const form = await request.formData();
    const source = String(form.get("source") ?? "");
    const type = String(form.get("type") ?? "");
    const file = form.get("file");

    if (!isAcademicSource(source)) {
      return NextResponse.json({ error: "Sumber data tidak valid." }, { status: 400 });
    }
    if (!isImportType(type)) {
      return NextResponse.json({ error: "Jenis impor tidak valid." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Berkas impor wajib diunggah." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Berkas melebihi batas 10 MB." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Berkas kosong." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await previewImport({
      buffer,
      fileName: file.name,
      source,
      type,
      actorId: session!.user.id,
    });
    return NextResponse.json(preview, { status: 201 });
  } catch (err) {
    if (err instanceof ImportFileError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AcademicImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logUnexpectedError("admin.academic-import.preview", err);
    return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
  }
}
