import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { GENERIC_API_ERROR, logUnexpectedError } from "@/lib/api-errors";
import { AcademicImportError, confirmImport } from "@/lib/academic-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  try {
    const batch = await confirmImport(id, session!.user.id);
    return NextResponse.json(batch);
  } catch (err) {
    if (err instanceof AcademicImportError) {
      return NextResponse.json(
        { error: err.message, ...(err.batchId ? { batchId: err.batchId } : {}) },
        { status: err.status }
      );
    }
    logUnexpectedError("admin.academic-import.confirm", err);
    return NextResponse.json(
      { error: GENERIC_API_ERROR, batchId: id },
      { status: 500 }
    );
  }
}
