import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import {
  INVALID_DATE_RANGE_MESSAGE,
  statsExportQuerySchema,
} from "@/lib/schemas/stats.schema";
import {
  generateGlobalReportCsv,
  generateGlobalReportPdf,
  getGlobalDashboardStats,
  StatsServiceError,
} from "@/lib/services/stats.service";

function safeFileNamePart(value: string) {
  return value.replace(/[^0-9A-Za-z-]/g, "");
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const parsed = statsExportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? INVALID_DATE_RANGE_MESSAGE },
      { status: 400 }
    );
  }

  try {
    const report = await getGlobalDashboardStats(parsed.data);
    const from = safeFileNamePart(report.filters.from);
    const to = safeFileNamePart(report.filters.to);
    const fileName = `laporan-global-${from}-${to}.${parsed.data.format}`;

    const body =
      parsed.data.format === "csv"
        ? generateGlobalReportCsv(report)
        : new Uint8Array(generateGlobalReportPdf(report));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          parsed.data.format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (caught) {
    if (caught instanceof StatsServiceError) {
      return NextResponse.json({ error: caught.message }, { status: caught.status });
    }
    return NextResponse.json(
      { error: "Gagal membuat laporan." },
      { status: 500 }
    );
  }
}
