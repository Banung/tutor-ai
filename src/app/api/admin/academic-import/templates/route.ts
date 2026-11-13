import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import { isImportType } from "@/lib/academic-import/service";
import { templateCsv, templateXlsx } from "@/lib/academic-import/templates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const type = request.nextUrl.searchParams.get("type") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!isImportType(type)) {
    return NextResponse.json({ error: "Jenis impor tidak valid." }, { status: 400 });
  }
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "Format template tidak valid." }, { status: 400 });
  }

  const base = `template-${type.toLowerCase().replace(/_/g, "-")}`;
  if (format === "csv") {
    return new NextResponse(templateCsv(type), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${base}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const buffer = await templateXlsx(type);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${base}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
