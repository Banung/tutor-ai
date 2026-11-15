"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  KeyRound,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
  isEnrolled?: boolean;
}

const GRID_OPTIONS = [
  { label: "2 Kolom", value: 2, class: "sm:grid-cols-2" },
  { label: "4 Kolom", value: 4, class: "sm:grid-cols-2 lg:grid-cols-4" },
  { label: "6 Kolom", value: 6, class: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" },
] as const;

function CourseCard({ course }: { course: MahasiswaCourse }) {
  const router = useRouter();

  return (
    <Card
      className="group cursor-pointer gap-0 overflow-hidden border-border/50 py-0 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
      onClick={() => router.push(`/mahasiswa/courses/${course.id}`)}
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
      </CardContent>
    </Card>
  );
}

function EnrollCourseDialog({
  open,
  onOpenChange,
  onEnrolled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: (courseId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MahasiswaCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<MahasiswaCourse | null>(null);
  const [enrollmentKey, setEnrollmentKey] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetDialog = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelectedCourse(null);
    setEnrollmentKey("");
    setSearching(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetDialog();
      return;
    }

    if (selectedCourse) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());

      fetch(`/api/mahasiswa/courses/available?${params}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data)) setResults(data);
        })
        .catch((err) => {
          if ((err as Error).name !== "AbortError") console.error(err);
        })
        .finally(() => setSearching(false));
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, query, resetDialog, selectedCourse]);

  async function handleEnroll() {
    if (!selectedCourse) {
      toast.error("Pilih course terlebih dahulu");
      return;
    }

    if (!enrollmentKey.trim()) {
      toast.error("Masukkan enrollment key");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/mahasiswa/courses/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          enrollmentKey: enrollmentKey.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Gagal bergabung ke course");
      }

      toast.success(`Berhasil bergabung ke ${selectedCourse.title}`);
      onOpenChange(false);
      onEnrolled(selectedCourse.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal bergabung ke course");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <DialogTitle>Tambah Course</DialogTitle>
          <DialogDescription>
            Cari mata kuliah, lalu masukkan enrollment key untuk bergabung.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[68vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-2">
            <Label htmlFor="available-course-search">Cari Mata Kuliah</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="available-course-search"
                placeholder="Cari semua course lintas jurusan..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedCourse(null);
                  setEnrollmentKey("");
                }}
                disabled={submitting}
                className="pl-9"
              />
            </div>
          </div>

          {selectedCourse ? (
            <div className="flex w-full items-start gap-3 rounded-lg border border-brand/30 bg-brand/5 p-3 text-left">
              <BookOpen className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selectedCourse.title}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {selectedCourse.description || "Belum ada deskripsi"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCourse(null);
                  setEnrollmentKey("");
                }}
                disabled={submitting}
                className="h-7 shrink-0 px-2"
              >
                Ganti
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {searching ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Mencari course...
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Course tidak ditemukan atau sudah Anda ikuti.
                </div>
              ) : (
                results.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      if (course.isEnrolled) return;
                      setSelectedCourse(course);
                      setQuery(course.title);
                    }}
                    disabled={course.isEnrolled}
                    className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-70"
                  >
                    <BookOpen className="mt-0.5 size-5 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{course.title}</p>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {course.description || "Belum ada deskripsi"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {course.isEnrolled ? "Sudah diikuti" : `${course._count.sessions} sesi`}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="enrollment-key">Enrollment Key</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="enrollment-key"
                placeholder="Masukkan key course"
                value={enrollmentKey}
                onChange={(event) => setEnrollmentKey(event.target.value.toUpperCase())}
                disabled={!selectedCourse || submitting}
                className="pl-9 font-mono tracking-wider"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            className="bg-brand text-black hover:bg-brand/90"
            onClick={handleEnroll}
            disabled={!selectedCourse || !enrollmentKey.trim() || submitting}
          >
            {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Bergabung
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MahasiswaCoursesClient({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const [courses, setCourses] = useState<MahasiswaCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [gridColumns, setGridColumns] = useState(4);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    fetch(`/api/mahasiswa/courses?${params}`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setCourses(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchCourses, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCourses]);

  const selectedGrid = GRID_OPTIONS.find((option) => option.value === gridColumns) ?? GRID_OPTIONS[1];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">
            Semua mata kuliah yang sedang Anda ikuti
          </p>
        </div>
        <Button
          onClick={() => setEnrollDialogOpen(true)}
          className="bg-brand text-black shadow-sm hover:bg-brand/90"
        >
          <Plus data-icon="inline-start" />
          Tambah Course
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="mahasiswa-courses-search"
            placeholder="Cari judul course..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSearch(searchInput);
            }}
            className="pl-9 pr-10"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="hidden h-10 shrink-0 bg-brand text-black shadow-sm hover:bg-brand/90 sm:inline-flex">
              <LayoutGrid data-icon="inline-start" />
              {selectedGrid.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {GRID_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setGridColumns(option.value)}
                className={
                  gridColumns === option.value
                    ? "bg-brand text-black focus:bg-brand focus:text-black"
                    : ""
                }
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className={`grid gap-5 ${selectedGrid.class}`}>
          {Array.from({ length: gridColumns }).map((_, index) => (
            <Card key={index} className="gap-0 overflow-hidden border-border/50 py-0">
              <div className="relative aspect-[1.55/1]">
                <Skeleton className="size-full rounded-none" />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
              </div>
              <CardContent className="flex min-h-40 flex-col gap-3 p-5 pt-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <div className="mt-auto flex gap-4 pt-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-4 size-12 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="font-medium text-muted-foreground">
              {search ? "Tidak ada course yang cocok" : "Belum ada course"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {search
                ? "Coba gunakan kata kunci yang berbeda"
                : "Anda belum terdaftar ke course apa pun."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-5 ${selectedGrid.class}`}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      <EnrollCourseDialog
        open={enrollDialogOpen}
        onOpenChange={setEnrollDialogOpen}
        onEnrolled={(courseId) => {
          fetchCourses();
          router.push(`/mahasiswa/courses/${courseId}`);
        }}
      />
    </div>
  );
}
