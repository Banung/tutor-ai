"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DosenUsageInsights } from "@/app/dosen/usage-insights";
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Search,
  ArrowRight,
  X,
  Users,
  FileText,
  MessageSquareWarning,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────── */

interface DosenCourse {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  enrollmentKey: string;
  isActive: boolean;
  createdAt: string;
  creator: { id: string; name: string };
  _count: { enrollments: number; sessions: number };
}

interface DosenStats {
  totalCourses: number;
  totalStudents: number;
  totalSessions: number;
}

interface ActivityItem {
  id: string;
  type: "material" | "session";
  title: string;
  detail: string;
  courseId: string;
  courseName: string;
  createdAt: string;
}

const PREVIEW_LIMIT = 4;

/* ─── Sub-Components ───────────────────────────────── */

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
}) {
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center gap-6 ml-1">
          <Icon className={`size-12 ${color}`} strokeWidth={1.5} />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {value !== undefined ? (
              <p className="text-3xl font-bold tracking-tight">{value}</p>
            ) : (
              <Skeleton className="h-9 w-20" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseCard({ course }: { course: DosenCourse }) {
  const router = useRouter();

  return (
    <Card
      className="group cursor-pointer gap-0 overflow-hidden border-border/50 py-0 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
      onClick={() => router.push(`/dosen/courses/${course.id}`)}
    >
      <div className="relative aspect-[1.55/1] bg-muted">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${course.coverImage ?? ""}")` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
            course.isActive
              ? "bg-brand text-black"
              : "bg-background/85 text-muted-foreground"
          }`}
        >
          {course.isActive ? "Aktif" : "Nonaktif"}
        </span>
      </div>
      <CardContent className="flex min-h-40 flex-col gap-3 p-5 pt-3">
        <h3 className="line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-brand">
          {course.title}
        </h3>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {course.description || "Belum ada deskripsi"}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <GraduationCap className="size-3.5" />
            {course._count.enrollments} Enrollment
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <CalendarDays className="size-3.5" />
            {course._count.sessions} Sesi Materi
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchDropdown({
  results,
  visible,
  onSelect,
}: {
  results: DosenCourse[];
  visible: boolean;
  onSelect: (id: string) => void;
}) {
  if (!visible || results.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-brand/25 bg-popover/95 p-1 shadow-xl shadow-brand/10 backdrop-blur animate-in fade-in slide-in-from-top-2 duration-150">
      {results.map((course) => (
        <button
          key={course.id}
          onClick={() => onSelect(course.id)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-brand/10"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/15">
            <BookOpen className="size-4 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{course.title}</p>
            {course.description && (
              <p className="truncate text-xs text-muted-foreground">
                {course.description}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {course._count.enrollments} mahasiswa
          </span>
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/* ─── Main Component ───────────────────────────────── */

export default function DosenDashboardPage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const [courses, setCourses] = useState<DosenCourse[]>([]);
  const [stats, setStats] = useState<DosenStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState<number | null>(null);
  const [pendingFeedbackLoading, setPendingFeedbackLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    fetch("/api/dosen/courses")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCourses(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchStats = useCallback(() => {
    fetch("/api/dosen/stats")
      .then((r) => r.json())
      .then((data) => { if (data && typeof data.totalCourses === "number") setStats(data); })
      .catch(console.error);
  }, []);

  const fetchActivities = useCallback(() => {
    fetch("/api/dosen/activities")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setActivities(data); })
      .catch(console.error);
  }, []);

  const fetchPendingFeedbackCount = useCallback(() => {
    fetch("/api/dosen/feedback?status=pending&page=1")
      .then((response) => {
        if (!response.ok) throw new Error("Gagal memuat feedback");
        return response.json();
      })
      .then((data: { total?: unknown }) => {
        setPendingFeedbackCount(typeof data.total === "number" ? data.total : null);
      })
      .catch(() => setPendingFeedbackCount(null))
      .finally(() => setPendingFeedbackLoading(false));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCourses();
      fetchStats();
      fetchActivities();
      fetchPendingFeedbackCount();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchCourses, fetchStats, fetchActivities, fetchPendingFeedbackCount]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(q) ||
        course.description?.toLowerCase().includes(q)
    );
  }, [searchQuery, courses]);

  const showDropdown = dropdownOpen && searchQuery.trim().length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const previewCourses = courses.slice(0, PREVIEW_LIMIT);
  const hasMoreCourses = courses.length > PREVIEW_LIMIT;
  const dosenName = session?.user?.name ?? "Dosen";

  const statCards = [
    { title: "Total Course", value: stats?.totalCourses, icon: BookOpen, color: "text-brand" },
    { title: "Total Enrollment", value: stats?.totalStudents, icon: Users, color: "text-blue-500" },
    { title: "Sesi Materi", value: stats?.totalSessions, icon: CalendarDays, color: "text-emerald-500" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Selamat datang, <span className="font-semibold text-foreground">{dosenName}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <DosenUsageInsights />

      <Card className="border-brand/20 bg-brand/[0.03]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <MessageSquareWarning className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Feedback perlu ditinjau</p>
              <p className="text-sm text-muted-foreground">
                {pendingFeedbackLoading
                  ? "Memuat antrean feedback…"
                  : pendingFeedbackCount === null
                    ? "Antrean feedback belum tersedia."
                    : pendingFeedbackCount === 0
                      ? "Tidak ada feedback baru yang menunggu."
                      : `${pendingFeedbackCount} feedback menunggu tinjauan.`}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/dosen/feedback")}>
            Buka antrean
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div
        ref={searchRef}
        className="relative w-full"
      >
        <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="dosen-search-course"
          placeholder="Cari course Anda..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => searchQuery.trim() && setDropdownOpen(true)}
          className="pl-9 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => { setSearchQuery(""); setDropdownOpen(false); }}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <SearchDropdown results={searchResults} visible={showDropdown} onSelect={(id) => { setDropdownOpen(false); setSearchQuery(""); router.push(`/dosen/courses/${id}`); }} />
      </div>

      {/* Course Cards */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Mata Kuliah Saya</h2>
          {hasMoreCourses && (
            <Button variant="ghost" size="sm" onClick={() => router.push("/dosen/courses")} className="gap-1.5 text-brand hover:text-brand/80 hover:bg-brand/5">
              Lihat Semua
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: PREVIEW_LIMIT }).map((_, i) => (
              <Card key={i} className="gap-0 overflow-hidden border-border/50 py-0">
                <div className="relative aspect-[1.55/1]">
                  <Skeleton className="size-full rounded-none" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
                </div>
                <CardContent className="flex min-h-40 flex-col gap-3 p-5 pt-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : previewCourses.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="size-12 text-muted-foreground/50 mb-4" strokeWidth={1.5} />
              <p className="text-muted-foreground font-medium">Belum ada course</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Anda belum ditugaskan ke course manapun oleh admin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {previewCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Aktivitas Terbaru</h2>
          <p className="text-sm text-muted-foreground">Aktivitas terakhir dari course Anda</p>
        </div>
        {activities.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/80 mb-4">
                <CalendarDays className="size-6 text-muted-foreground/60" />
              </div>
              <p className="text-muted-foreground font-medium">Belum ada aktivitas</p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                Aktivitas akan muncul saat Anda membuat sesi atau menambah materi.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.slice(0, 5).map((activity) => (
              <Card
                key={`${activity.type}-${activity.id}`}
                className="border-border/50 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => router.push(`/dosen/courses/${activity.courseId}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    activity.type === "material" ? "bg-red-500/10" : "bg-brand/10"
                  }`}>
                    {activity.type === "material" ? (
                      <FileText className="size-5 text-red-600" />
                    ) : (
                      <CalendarDays className="size-5 text-brand" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium text-foreground/70">{activity.courseName}</span>
                      {" · "}
                      {activity.detail}
                      {" · "}
                      <span className="italic">
                        {activity.type === "material" ? "Materi ditambahkan" : "Sesi dibuat"}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(activity.createdAt)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
