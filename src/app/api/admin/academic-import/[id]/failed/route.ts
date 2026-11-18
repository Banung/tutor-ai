import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import { GENERIC_API_ERROR, logUnexpectedError } from "@/lib/api-errors";
import { AcademicImportError, failedRowsCsv } from "@/lib/academic-import/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  try {
    const csv = await failedRowsCsv(id);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="failed-rows-${id}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AcademicImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logUnexpectedError("admin.academic-import.failed-export", err);
    return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
  }
}
