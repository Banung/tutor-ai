import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import { GENERIC_API_ERROR, logUnexpectedError } from "@/lib/api-errors";
import { AcademicImportError, listBatches } from "@/lib/academic-import/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    return NextResponse.json(await listBatches());
  } catch (err) {
    if (err instanceof AcademicImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logUnexpectedError("admin.academic-import.list", err);
    return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
  }
}
