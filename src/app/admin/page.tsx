"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  Inbox,
  Loader2,
  MessageSquare,
  RotateCcw,
  Users,
} from "lucide-react";
import type {
  ActivityTrendBucket,
  GlobalDashboardReport,
  InactiveCourseStat,
  StudyProgramStat,
} from "@/lib/services/stats.service";

const INVALID_DATE_RANGE_MESSAGE = "Rentang tanggal tidak valid.";
const ALL_PROGRAMS = "all";

type Filters = { from: string; to: string; studyProgramId: string };

const EMPTY_FILTERS: Filters = { from: "", to: "", studyProgramId: ALL_PROGRAMS };

interface Faculty {
  id: string;
  name: string;
  studyPrograms: { id: string; name: string }[];
}

const CATALOG_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Dipublikasikan",
  ARCHIVED: "Diarsipkan",
};

const CATALOG_CLASS: Record<string, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

function buildQuery(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.studyProgramId !== ALL_PROGRAMS) {
    params.set("studyProgramId", filters.studyProgramId);
  }
  return params;
}

function readError(payload: unknown, fallback: string) {
  const message = (payload as { error?: unknown } | null)?.error;
  return typeof message === "string" ? message : fallback;
}

function formatNumber(value: number | undefined) {
  return value === undefined ? undefined : value.toLocaleString("id-ID");
}

function formatDay(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | undefined;
  hint?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
}) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <Icon className={`size-10 shrink-0 ${color}`} strokeWidth={1.5} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {value !== undefined ? (
              <p className="text-2xl font-bold tracking-tight">
                {formatNumber(value)}
              </p>
            ) : (
              <Skeleton className="h-8 w-20" />
            )}
            {hint ? (
              <p className="truncate text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-medium tabular-nums">
        {value.toLocaleString("id-ID")}
      </span>
    </div>
  );
}

function ProgramDistributionCard({
  program,
  max,
}: {
  program: StudyProgramStat;
  max: Record<MetricKey, number>;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="font-medium">{program.studyProgramName}</p>
          <p className="text-xs text-muted-foreground">
            {program.facultyName ?? "Fakultas belum ditentukan"}
          </p>
        </div>
        <div className="space-y-2">
          {PROGRAM_METRICS.map(({ key, label }) => (
            <MetricBar
              key={key}
              label={label}
              value={program[key]}
              max={max[key]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type MetricKey =
  | "courseCount"
  | "publishedCourseCount"
  | "enrollmentCount"
  | "chatSessionCount"
  | "messageCount"
  | "inactiveCourseCount";

const PROGRAM_METRICS: { key: MetricKey; label: string }[] = [
  { key: "courseCount", label: "Mata kuliah" },
  { key: "publishedCourseCount", label: "Dipublikasikan" },
  { key: "enrollmentCount", label: "Pendaftaran" },
  { key: "chatSessionCount", label: "Sesi chat" },
  { key: "messageCount", label: "Pesan chat" },
  { key: "inactiveCourseCount", label: "MK nonaktif" },
];

const TREND_MAX_PX = 96;

function TrendBar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className: string;
  label: string;
}) {
  const height = max > 0 ? Math.max((value / max) * TREND_MAX_PX, 2) : 2;
  return (
    <div
      className={`w-1.5 rounded-t ${className}`}
      style={{ height: `${height}px` }}
      title={`${label}: ${value}`}
    />
  );
}

function ActivityTrendChart({ trend }: { trend: ActivityTrendBucket[] }) {
  const max = useMemo(
    () =>
      trend.reduce(
        (current, bucket) =>
          Math.max(
            current,
            bucket.chatSessions,
            bucket.messages,
            bucket.enrollments
          ),
        0
      ),
    [trend]
  );

  return (
    <Card className="border-border/50">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Tren Aktivitas Harian</p>
            <p className="text-xs text-muted-foreground">
              Sesi chat, pesan, dan pendaftaran per hari pada periode terpilih
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand" /> Sesi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" /> Pesan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Pendaftaran
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div
            className="flex min-w-full items-end gap-2"
            style={{ height: `${TREND_MAX_PX + 32}px` }}
          >
            {trend.map((bucket) => (
              <div
                key={bucket.date}
                className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"
                title={`${bucket.date} — ${bucket.chatSessions} sesi, ${bucket.messages} pesan, ${bucket.enrollments} pendaftaran`}
              >
                <div className="flex items-end gap-0.5">
                  <TrendBar
                    value={bucket.chatSessions}
                    max={max}
                    className="bg-brand"
                    label="Sesi"
                  />
                  <TrendBar
                    value={bucket.messages}
                    max={max}
                    className="bg-blue-500"
                    label="Pesan"
                  />
                  <TrendBar
                    value={bucket.enrollments}
                    max={max}
                    className="bg-emerald-500"
                    label="Pendaftaran"
                  />
                </div>
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                  {formatDay(bucket.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function catalogBadge(status: string) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        CATALOG_CLASS[status] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {CATALOG_LABEL[status] ?? status}
    </span>
  );
}

function inactiveDaysBadge(course: InactiveCourseStat) {
  if (course.daysSinceInteraction === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
        Belum ada interaksi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
      {course.daysSinceInteraction} hari
    </span>
  );
}

function lastInteractionLabel(course: InactiveCourseStat) {
  if (!course.lastInteractionAt) return "Belum ada";
  const parsed = new Date(course.lastInteractionAt);
  if (Number.isNaN(parsed.getTime())) return course.lastInteractionAt;
  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<GlobalDashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [reloadToken, setReloadToken] = useState(0);

  const rangeError =
    draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to
      ? INVALID_DATE_RANGE_MESSAGE
      : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/academic/faculties", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setFaculties(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildQuery(appliedFilters);

    fetch(`/api/admin/stats?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(readError(data, "Gagal memuat statistik."));
        }
        setStats(data as GlobalDashboardReport);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setStats(null);
        setLoadError(
          caught instanceof Error ? caught.message : "Gagal memuat statistik."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [appliedFilters, reloadToken]);

  const programs = useMemo(
    () =>
      faculties.flatMap((faculty) =>
        faculty.studyPrograms.map((program) => ({
          ...program,
          facultyName: faculty.name,
        }))
      ),
    [faculties]
  );

  const programMax = useMemo(() => {
    const distribution = stats?.studyProgramDistribution ?? [];
    const maximum = Object.fromEntries(
      PROGRAM_METRICS.map(({ key }) => [
        key,
        distribution.reduce((current, program) => Math.max(current, program[key]), 0),
      ])
    ) as Record<MetricKey, number>;
    return maximum;
  }, [stats]);

  const kpis = stats?.kpis;
  const exportDisabled = Boolean(rangeError) || loading;

  function applyFilters() {
    if (rangeError) return;
    setLoading(true);
    setLoadError(null);
    setAppliedFilters({ ...draftFilters });
  }

  function resetFilters() {
    setLoading(true);
    setLoadError(null);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setReloadToken((token) => token + 1);
  }

  function downloadReport(format: "csv" | "pdf") {
    if (exportDisabled) return;
    const params = buildQuery(appliedFilters);
    params.set("format", format);
    window.location.href = `/api/admin/stats/export?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Global</h1>
          <p className="text-muted-foreground">
            Monitor aktivitas dan statistik sistem Tutor AI secara agregat
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadReport("csv")}
            disabled={exportDisabled}
            className="gap-2"
          >
            <Download className="size-4" />
            Ekspor CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadReport("pdf")}
            disabled={exportDisabled}
            className="gap-2"
          >
            <Download className="size-4" />
            Ekspor PDF
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-border/50">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,170px))_minmax(0,260px)_auto]">
            <div className="grid gap-2">
              <Label htmlFor="stats-from">Dari Tanggal</Label>
              <Input
                id="stats-from"
                type="date"
                value={draftFilters.from}
                onChange={(event) =>
                  setDraftFilters({ ...draftFilters, from: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stats-to">Sampai Tanggal</Label>
              <Input
                id="stats-to"
                type="date"
                value={draftFilters.to}
                onChange={(event) =>
                  setDraftFilters({ ...draftFilters, to: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Program Studi</Label>
              <Select
                value={draftFilters.studyProgramId}
                onValueChange={(value) =>
                  setDraftFilters({ ...draftFilters, studyProgramId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Program Studi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROGRAMS}>Semua Program Studi</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name} — {program.facultyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={applyFilters}
                disabled={Boolean(rangeError) || loading}
                className="gap-2 bg-brand text-black hover:bg-brand/90"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Terapkan
              </Button>
              <Button
                variant="ghost"
                onClick={resetFilters}
                disabled={loading}
                className="gap-2"
              >
                <RotateCcw className="size-4" />
                Reset
              </Button>
            </div>
          </div>

          {rangeError ? (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              {rangeError}
            </p>
          ) : stats ? (
            <p className="text-xs text-muted-foreground">
              Periode {stats.filters.from} s/d {stats.filters.to} ·{" "}
              {stats.filters.studyProgramName ?? "Semua Program Studi"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {loadError ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              setReloadToken((token) => token + 1);
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      {/* ALT-1: empty activity period */}
      {stats && !stats.hasActivityData ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <Inbox className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium">Tidak ada data pada periode terpilih</p>
            <p className="text-xs text-muted-foreground">
              Tidak ada aktivitas chat atau pendaftaran pada rentang tanggal ini.
              Total pengguna dan katalog tetap ditampilkan sebagai data global.
            </p>
          </div>
        </div>
      ) : null}

      {/* KPI summary */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Pengguna"
          value={kpis?.totalUsers}
          hint={
            kpis
              ? `Admin ${formatNumber(kpis.admin)} · Dosen ${formatNumber(
                  kpis.dosen
                )} · Mahasiswa ${formatNumber(kpis.mahasiswa)}`
              : undefined
          }
          icon={Users}
          color="text-brand"
        />
        <StatCard
          title="Total Mata Kuliah"
          value={kpis?.totalCourses}
          hint={
            kpis
              ? `${formatNumber(kpis.activeCourses)} aktif · ${formatNumber(
                  kpis.publishedCourses
                )} dipublikasikan`
              : undefined
          }
          icon={BookOpen}
          color="text-violet-500"
        />
        <StatCard
          title="Total Pendaftaran"
          value={kpis?.totalEnrollments}
          hint={
            kpis
              ? `${formatNumber(kpis.periodEnrollments)} pendaftaran periode ini`
              : undefined
          }
          icon={ClipboardList}
          color="text-pink-500"
        />
        <StatCard
          title="Aktivitas Chat AI"
          value={kpis?.chatSessions}
          hint={kpis ? `${formatNumber(kpis.chatMessages)} pesan chat` : undefined}
          icon={MessageSquare}
          color="text-blue-500"
        />
        <StatCard
          title="Mata Kuliah Nonaktif"
          value={kpis?.inactiveCourseCount}
          hint="Lebih dari 4 minggu tanpa interaksi"
          icon={Activity}
          color="text-amber-500"
        />
      </div>

      {/* Distribution */}
      {stats && stats.studyProgramDistribution.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Sebaran Aktivitas per Program Studi
            </h2>
            <p className="text-sm text-muted-foreground">
              Perbandingan katalog dan aktivitas antar program studi
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {stats.studyProgramDistribution.map((program) => (
              <ProgramDistributionCard
                key={program.studyProgramId ?? program.studyProgramName}
                program={program}
                max={programMax}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Trend */}
      {stats?.hasActivityData ? (
        <ActivityTrendChart trend={stats.activityTrend} />
      ) : null}

      {/* Inactive courses (BR-015) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Mata Kuliah Tanpa Interaksi &gt; 4 Minggu
          </h2>
          <p className="text-sm text-muted-foreground">
            BR-015 · Mata kuliah tanpa aktivitas chat lebih dari 28 hari
          </p>
        </div>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Mata Kuliah</TableHead>
                <TableHead>Program Studi</TableHead>
                <TableHead>Status Katalog</TableHead>
                <TableHead className="text-center">Pendaftaran</TableHead>
                <TableHead>Interaksi Terakhir</TableHead>
                <TableHead className="pr-6">Hari Sejak Interaksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !stats || stats.inactiveCourses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Tidak ada mata kuliah tanpa interaksi pada periode ini
                  </TableCell>
                </TableRow>
              ) : (
                stats.inactiveCourses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell className="max-w-[280px] pl-6">
                      <Link
                        href={`/admin/courses/${course.courseId}`}
                        className="group flex flex-col"
                      >
                        <span className="flex items-center gap-2 font-medium group-hover:text-brand">
                          {course.courseCode ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {course.courseCode}
                            </span>
                          ) : null}
                          <span className="truncate">{course.title}</span>
                          <ArrowRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{course.studyProgramName}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.facultyName}
                      </p>
                    </TableCell>
                    <TableCell>{catalogBadge(course.catalogStatus)}</TableCell>
                    <TableCell className="text-center font-medium">
                      {course.enrollmentCount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastInteractionLabel(course)}
                    </TableCell>
                    <TableCell className="pr-6">
                      {inactiveDaysBadge(course)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pintasan Admin
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/admin/users", label: "User Management", icon: Users },
            { href: "/admin/courses", label: "Katalog Mata Kuliah", icon: BookOpen },
            {
              href: "/admin/academic-import",
              label: "Impor Akademik",
              icon: ClipboardList,
            },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-brand" />
                {label}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
