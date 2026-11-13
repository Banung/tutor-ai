import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { GENERIC_API_ERROR, logUnexpectedError } from "@/lib/api-errors";
import { AcademicImportError, getBatch } from "@/lib/academic-import/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  try {
    return NextResponse.json(await getBatch(id));
  } catch (err) {
    if (err instanceof AcademicImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logUnexpectedError("admin.academic-import.detail", err);
    return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
  }
}
