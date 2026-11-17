"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageCircle,
  Search,
  X,
} from "lucide-react";

interface MahasiswaCourse {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  isActive: boolean;
  createdAt: string;
  creator: { id: string; name: string };
  instructors: { id: string; user: { id: string; name: string } }[];
  _count: { instructors: number; sessions: number };
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

function courseDetailHref(courseId: string) {
  return `/mahasiswa/courses/${courseId}`;
}

function CourseCard({ course }: { course: MahasiswaCourse }) {
  const router = useRouter();

  return (
    <Card
      className="group cursor-pointer gap-0 overflow-hidden border-border/50 py-0 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
      onClick={() => router.push(courseDetailHref(course.id))}
    >
      <div className="relative aspect-[1.55/1] bg-muted">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${course.coverImage ?? ""}")` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
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
            {course._count.instructors} Dosen
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <CalendarDays className="size-3.5" />
            {course._count.sessions} Sesi
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1 w-full gap-2 border-brand/30 hover:bg-brand/10 hover:text-foreground"
          aria-label={`Tanya Tutor AI tentang ${course.title}`}
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/mahasiswa/courses/${course.id}/tutor`);
          }}
        >
          <MessageCircle className="size-4" />
          Tanya Tutor AI
        </Button>
      </CardContent>
    </Card>
  );
}

function SearchDropdown({
  results,
  visible,
  onSelect,
}: {
  results: MahasiswaCourse[];
  visible: boolean;
  onSelect: (course: MahasiswaCourse) => void;
}) {
  if (!visible || results.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-brand/25 bg-popover/95 p-1 shadow-xl shadow-brand/10 backdrop-blur animate-in fade-in slide-in-from-top-2 duration-150">
      {results.map((course) => (
        <button
          key={course.id}
          onClick={() => onSelect(course)}
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
            {course._count.sessions} sesi
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

export default function MahasiswaDashboardPage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const [courses, setCourses] = useState<MahasiswaCourse[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    fetch("/api/mahasiswa/courses")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setCourses(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchActivities = useCallback(() => {
    fetch("/api/mahasiswa/activities")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setActivities(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCourses();
      fetchActivities();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchCourses, fetchActivities]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query)
    );
  }, [courses, searchQuery]);

  const previewCourses = courses.slice(0, PREVIEW_LIMIT);
  const hasMoreCourses = courses.length > PREVIEW_LIMIT;
  const mahasiswaName = session?.user?.name ?? "Mahasiswa";
  const showDropdown = dropdownOpen && searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Selamat datang,{" "}
          <span className="font-semibold text-foreground">{mahasiswaName}</span>
        </p>
      </div>

      <div
        ref={searchRef}
        className="relative w-full"
      >
        <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="mahasiswa-search-course"
          placeholder="Cari mata kuliah yang Anda ikuti..."
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => searchQuery.trim() && setDropdownOpen(true)}
          className="pl-9 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => {
              setSearchQuery("");
              setDropdownOpen(false);
            }}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <SearchDropdown
          results={searchResults}
          visible={showDropdown}
          onSelect={(course) => {
            setDropdownOpen(false);
            setSearchQuery("");
            router.push(courseDetailHref(course.id));
          }}
        />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Mata Kuliah Saya</h2>
          {hasMoreCourses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/mahasiswa/courses")}
              className="gap-1.5 text-brand hover:bg-brand/5 hover:text-brand/80"
            >
              Selengkapnya
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: PREVIEW_LIMIT }).map((_, index) => (
              <Card key={index} className="gap-0 overflow-hidden border-border/50 py-0">
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
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-4 size-12 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="font-medium text-muted-foreground">Belum ada course</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Anda belum terdaftar ke course apa pun.
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

      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Aktivitas Terbaru</h2>
          <p className="text-sm text-muted-foreground">
            Aktivitas terbaru dari mata kuliah yang Anda ikuti
          </p>
        </div>

        {activities.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/80">
                <CalendarDays className="size-6 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-muted-foreground">Belum ada aktivitas</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
                Aktivitas akan muncul saat ada sesi atau materi baru dari course yang Anda ikuti.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.map((activity) => (
              <Card
                key={`${activity.type}-${activity.id}`}
                className="cursor-pointer border-border/50 transition-shadow hover:shadow-sm"
                onClick={() => router.push(courseDetailHref(activity.courseId))}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                      activity.type === "material" ? "bg-red-500/10" : "bg-brand/10"
                    }`}
                  >
                    {activity.type === "material" ? (
                      <FileText className="size-5 text-red-600" />
                    ) : (
                      <CalendarDays className="size-5 text-brand" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{activity.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">
                        {activity.courseName}
                      </span>
                      {" - "}
                      {activity.detail}
                      {" - "}
                      <span className="italic">
                        {activity.type === "material" ? "Materi ditambahkan" : "Sesi dibuat"}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
