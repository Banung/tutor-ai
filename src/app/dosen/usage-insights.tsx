"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  MessageCircleQuestion,
  MessagesSquare,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UsagePeriod = 7 | 30 | 90;

interface UsageAnalytics {
  period: UsagePeriod;
  courseId: string | null;
  availableCourses: Array<{ id: string; title: string }>;
  totals: {
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  };
  series: Array<{
    date: string;
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  }>;
  courses: Array<{
    id: string;
    title: string;
    sessions: number;
    activeStudents: number;
    studentQuestions: number;
  }>;
}

const SERIES = [
  { key: "sessions", label: "Sesi chat", color: "#f9b129" },
  { key: "activeStudents", label: "Mahasiswa aktif per hari", color: "#3b82f6" },
  { key: "studentQuestions", label: "Pertanyaan", color: "#10b981" },
] as const;

function formatCount(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function UsageChart({ data, period }: { data: UsageAnalytics; period: UsagePeriod }) {
  const width = 720;
  const height = 260;
  const left = 50;
  const right = 14;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(
    1,
    ...data.series.flatMap((point) => [
      point.sessions,
      point.activeStudents,
      point.studentQuestions,
    ])
  );
  const middle = Math.ceil(maximum / 2);
  const ticks = [...new Set([0, middle, maximum])];
  const pointsFor = (key: (typeof SERIES)[number]["key"]) =>
    data.series.map((point, index) => {
      const x = left + (data.series.length <= 1 ? 0 : (index / (data.series.length - 1)) * plotWidth);
      const y = top + plotHeight - (point[key] / maximum) * plotHeight;
      return { x, y, value: point[key], date: point.date };
    });

  const labelCount = period === 7 ? 4 : period === 30 ? 5 : 7;
  const labelStep = Math.max(1, Math.ceil((data.series.length - 1) / (labelCount - 1)));
  const labelIndices = new Set<number>([0, data.series.length - 1]);
  for (let index = labelStep; index < data.series.length - 1; index += labelStep) {
    labelIndices.add(index);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
        {SERIES.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          className="h-auto w-full"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Grafik sesi chat, mahasiswa aktif, dan pertanyaan selama ${period} hari terakhir`}
        >
          {ticks.map((tick) => {
            const y = top + plotHeight - (tick / maximum) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeDasharray={tick === 0 ? undefined : "3 5"}
                />
                <text
                  x={left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize="11"
                >
                  {formatCount(tick)}
                </text>
              </g>
            );
          })}

          {data.series.map((point, index) => {
            if (!labelIndices.has(index)) return null;
            const x = left + (data.series.length <= 1 ? 0 : (index / (data.series.length - 1)) * plotWidth);
            return (
              <text
                key={point.date}
                x={x}
                y={height - 12}
                textAnchor={index === 0 ? "start" : index === data.series.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground"
                fontSize="11"
              >
                {formatDate(point.date)}
              </text>
            );
          })}

          {SERIES.map((item) => {
            const points = pointsFor(item.key);
            const path = points
              .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
              .join(" ");
            return (
              <g key={item.key}>
                <path
                  d={path}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {points.map((point) => (
                  <circle
                    key={`${item.key}-${point.date}`}
                    cx={point.x}
                    cy={point.y}
                    r={period === 90 ? 1.8 : 3}
                    fill={item.color}
                    stroke="var(--card)"
                    strokeWidth="1.5"
                  >
                    <title>{`${formatDate(point.date)} · ${item.label}: ${formatCount(point.value)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Memuat analitik penggunaan Tutor AI">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DosenUsageInsights() {
  const [period, setPeriod] = useState<UsagePeriod>(30);
  const [courseId, setCourseId] = useState("all");
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ days: String(period) });
    if (courseId !== "all") params.set("courseId", courseId);

    async function loadUsage() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/dosen/usage?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as UsageAnalytics & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Gagal memuat analitik Tutor AI.");
        setData(result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Gagal memuat analitik Tutor AI.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadUsage();
    return () => controller.abort();
  }, [period, courseId, retryVersion]);

  const hasUsage = useMemo(
    () =>
      Boolean(
        data &&
          (data.totals.sessions > 0 ||
            data.totals.activeStudents > 0 ||
            data.totals.studentQuestions > 0)
      ),
    [data]
  );

  return (
    <section className="flex flex-col gap-5" aria-labelledby="usage-insights-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Tutor AI
          </p>
          <h2 id="usage-insights-title" className="text-xl font-bold tracking-tight">
            Insight Penggunaan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan aktivitas belajar di mata kuliah yang Anda ampu.
          </p>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 md:w-auto md:min-w-[390px]">
          <Select value={courseId} onValueChange={(value) => setCourseId(value ?? "all")}>
            <SelectTrigger aria-label="Filter mata kuliah" className="w-full">
              <SelectValue placeholder="Semua mata kuliah" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua mata kuliah</SelectItem>
              {(data?.availableCourses ?? []).map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(period)}
            onValueChange={(value) => {
              if (value === "7" || value === "30" || value === "90") {
                setPeriod(Number(value) as UsagePeriod);
              }
            }}
          >
            <SelectTrigger aria-label="Filter rentang waktu" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 hari terakhir</SelectItem>
              <SelectItem value="30">30 hari terakhir</SelectItem>
              <SelectItem value="90">90 hari terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Analitik belum dapat dimuat</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => setRetryVersion((version) => version + 1)}>
              <RefreshCw data-icon="inline-start" />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : data && data.availableCourses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-3 size-9 text-muted-foreground/60" strokeWidth={1.5} />
            <p className="font-semibold">Belum ada mata kuliah</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Insight Tutor AI akan tersedia setelah Anda ditugaskan ke mata kuliah.
            </p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Sesi chat dibuat"
              value={data.totals.sessions}
              detail="Dikelompokkan berdasarkan waktu sesi dimulai"
              icon={MessagesSquare}
              tone="brand"
            />
            <MetricCard
              label="Mahasiswa aktif"
              value={data.totals.activeStudents}
              detail="Mahasiswa dengan pesan pada periode ini"
              icon={UsersRound}
              tone="blue"
            />
            <MetricCard
              label="Pertanyaan mahasiswa"
              value={data.totals.studentQuestions}
              detail="Pesan mahasiswa yang dikirim pada periode ini"
              icon={MessageCircleQuestion}
              tone="green"
            />
          </div>

          <Card>
            <CardHeader className="pb-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Aktivitas per hari</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sesi dihitung saat dimulai; pertanyaan dihitung saat dikirim.
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Activity className="size-3.5" />
                  {period} hari terakhir
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {hasUsage ? (
                <UsageChart data={data} period={period} />
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                  <Activity className="mb-2 size-7 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Belum ada aktivitas Tutor AI</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Belum ada sesi atau pertanyaan pada rentang waktu ini.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ringkasan per mata kuliah</CardTitle>
              <p className="text-sm text-muted-foreground">
                Jumlah sesi, mahasiswa aktif, dan pertanyaan pada periode terpilih.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-y bg-muted/30 text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-5 py-3 font-medium">Mata kuliah</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Sesi chat</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Mahasiswa aktif</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Pertanyaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.map((course) => (
                      <tr key={course.id} className="border-b last:border-0">
                        <th scope="row" className="max-w-[260px] px-5 py-3.5 text-left font-medium">
                          <span className="block truncate">{course.title}</span>
                        </th>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatCount(course.sessions)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatCount(course.activeStudents)}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{formatCount(course.studentQuestions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.courses.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada mata kuliah pada filter terpilih.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "brand" | "blue" | "green";
}) {
  const toneClass = {
    brand: "bg-brand/12 text-brand",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-[126px] items-start gap-3.5 p-4 sm:p-5">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{formatCount(value)}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
