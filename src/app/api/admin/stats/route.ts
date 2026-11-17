import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import {
  INVALID_DATE_RANGE_MESSAGE,
  statsFilterSchema,
} from "@/lib/schemas/stats.schema";
import {
  getGlobalDashboardStats,
  StatsServiceError,
} from "@/lib/services/stats.service";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const parsed = statsFilterSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? INVALID_DATE_RANGE_MESSAGE },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await getGlobalDashboardStats(parsed.data));
  } catch (caught) {
    if (caught instanceof StatsServiceError) {
      return NextResponse.json({ error: caught.message }, { status: caught.status });
    }
    return NextResponse.json(
      { error: "Gagal memuat statistik." },
      { status: 500 }
    );
  }
}
