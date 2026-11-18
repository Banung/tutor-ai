import { NextRequest, NextResponse } from "next/server";
import { requireDosen } from "@/lib/api-utils";
import {
  DosenUsageAnalyticsError,
  getDosenUsageAnalytics,
  type UsagePeriod,
} from "@/lib/services/dosen-usage-analytics.service";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const VALID_PERIODS = [7, 30, 90] as const;

export async function GET(request: NextRequest) {
  const { error, session } = await requireDosen(request);
  if (error) return error;

  const rawPeriod = request.nextUrl.searchParams.get("days") ?? "30";
  const period = Number(rawPeriod);
  if (!VALID_PERIODS.includes(period as (typeof VALID_PERIODS)[number])) {
    return NextResponse.json(
      { error: "Periode harus 7, 30, atau 90 hari." },
      { status: 400, headers: PRIVATE_HEADERS }
    );
  }

  const courseId = request.nextUrl.searchParams.get("courseId") || null;

  try {
    const analytics = await getDosenUsageAnalytics(
      session!.user.id,
      period as UsagePeriod,
      courseId
    );
    return NextResponse.json(analytics, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof DosenUsageAnalyticsError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Gagal memuat analitik penggunaan Tutor AI." },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
