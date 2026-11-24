"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CourseAcademicLabels,
  formatAcademicUnitName,
  type CourseStudyProgram,
} from "@/components/courses/course-academic-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AvailableCoursesEnrollmentFilter } from "@/lib/services/mahasiswa.service";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Compass,
  GraduationCap,
  KeyRound,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

type CatalogStudyProgram = {
  id: string;
  name: string;
  code: string | null;
  courseCount: number;
};

type CatalogFaculty = {
  id: string;
  name: string;
  code: string | null;
  courseCount: number;
  studyPrograms: CatalogStudyProgram[];
};

type CatalogDirectory = {
  totalCourses: number;
  faculties: CatalogFaculty[];
};

interface CatalogCourse {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  learningOutcomes: string | null;
  coverImage: string | null;
  isActive: boolean;
  createdAt: string;
  creator: { id: string; name: string };
  instructors: { id: string; user: { id: string; name: string } }[];
  studyProgram: (CourseStudyProgram & { id: string; faculty: { id: string; name: string } }) | null;
  _count: { instructors: number; sessions: number };
  isEnrolled: boolean;
}

const ENROLLMENT_OPTIONS: { value: AvailableCoursesEnrollmentFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "not_enrolled", label: "Belum Diikuti" },
  { value: "enrolled", label: "Sudah Diikuti" },
];

function extractErrorMessage(data: unknown, fallback: string): string {
  const error = (data as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (Array.isArray(error)) {
    const messages = error
      .map((issue) => (issue as { message?: unknown })?.message)
      .filter((message): message is string => typeof message === "string" && message.trim().length > 0);
    if (messages.length > 0) return messages.join(", ");
  }
  return fallback;
}

function CatalogCourseCard({
  course,
  onSelectForEnroll,
}: {
  course: CatalogCourse;
  onSelectForEnroll: (course: CatalogCourse) => void;
}) {
  return (
    <Card className="flex flex-col gap-0 overflow-hidden border-border/50 py-0">
      <div className="relative aspect-[1.55/1] bg-muted">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${course.coverImage ?? ""}")` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
        {course.courseCode && (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 rounded-md bg-background/90 font-mono text-[11px] font-semibold text-foreground shadow-sm"
          >
            {course.courseCode}
          </Badge>
        )}
        {course.isEnrolled && (
          <Badge className="absolute right-3 top-3 bg-emerald-700 text-white shadow-sm">
            Sudah Diikuti
          </Badge>
        )}
      </div>

      <CardContent className="flex min-h-44 flex-1 flex-col gap-3 p-5 pt-3">
        <h2 className="line-clamp-2 text-base font-bold leading-snug">{course.title}</h2>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {course.description || "Belum ada deskripsi"}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <GraduationCap className="size-3.5" aria-hidden="true" />
            {course._count.instructors} Dosen
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {course._count.sessions} Sesi
          </span>
        </div>

        <CourseAcademicLabels studyProgram={course.studyProgram} />

        {course.isEnrolled ? (
          <Button asChild variant="outline" className="mt-1 w-full">
            <Link href={`/mahasiswa/courses/${course.id}`}>
              Buka Course
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            className="mt-1 w-full bg-brand text-black hover:bg-brand/90"
            onClick={() => onSelectForEnroll(course)}
          >
            <KeyRound data-icon="inline-start" />
            Gabung dengan Key
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CatalogEnrollDialog({
  course,
  open,
  onOpenChange,
  enrollmentKey,
  onEnrollmentKeyChange,
  enrollError,
  submitting,
  onSubmit,
}: {
  course: CatalogCourse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentKey: string;
  onEnrollmentKeyChange: (value: string) => void;
  enrollError: string | null;
  submitting: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const instructorNames = useMemo(() => {
    if (!course) return "";
    const names = course.instructors
      .map((item) => item.user.name.trim())
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : course.creator.name;
  }, [course]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[540px]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            {course?.courseCode && (
              <Badge variant="outline" className="font-mono text-xs">
                {course.courseCode}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg leading-snug">
            {course?.title ?? "Gabung Course"}
          </DialogTitle>
          <DialogDescription>
            Masukkan enrollment key untuk mengakses materi dan Tutor AI pada mata kuliah ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto px-6 py-5">
            {course && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
                <CourseAcademicLabels studyProgram={course.studyProgram} />

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {course.description || "Belum ada deskripsi untuk mata kuliah ini."}
                </p>

                {course.learningOutcomes && (
                  <div className="flex flex-col gap-1 border-t pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Capaian Pembelajaran
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                      {course.learningOutcomes}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Dosen Pengampu: {instructorNames}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{course._count.sessions} Sesi Materi</span>
                  </span>
                </div>
              </div>
            )}

            <FieldGroup>
              <Field data-invalid={Boolean(enrollError)}>
                <FieldLabel htmlFor="catalog-enrollment-key">Enrollment Key</FieldLabel>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="catalog-enrollment-key"
                    placeholder="Contoh: ABCD2345"
                    value={enrollmentKey}
                    onChange={(event) =>
                      onEnrollmentKeyChange(event.target.value.toUpperCase())
                    }
                    disabled={submitting}
                    aria-invalid={Boolean(enrollError)}
                    autoFocus
                    className="pl-9 font-mono tracking-wider"
                  />
                </div>
                {enrollError && <FieldError>{enrollError}</FieldError>}
                <FieldDescription>
                  Minta enrollment key kepada dosen pengampu mata kuliah ini.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-brand text-black hover:bg-brand/90"
              disabled={!course || !enrollmentKey.trim() || submitting}
            >
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Gabung ke Course
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MahasiswaCatalogClient({
  initialSearch,
  initialFacultyId,
  initialStudyProgramId,
  initialEnrollment,
}: {
  initialSearch: string;
  initialFacultyId: string;
  initialStudyProgramId: string;
  initialEnrollment: AvailableCoursesEnrollmentFilter;
}) {
  const router = useRouter();
  const [directory, setDirectory] = useState<CatalogDirectory | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch.trim());
  const [facultyId, setFacultyId] = useState(initialFacultyId);
  const [studyProgramId, setStudyProgramId] = useState(initialStudyProgramId);
  const [enrollment, setEnrollment] =
    useState<AvailableCoursesEnrollmentFilter>(initialEnrollment);

  const [selectedCourse, setSelectedCourse] = useState<CatalogCourse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollmentKey, setEnrollmentKey] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isFirstSearchEffect = useRef(true);

  const fetchDirectory = useCallback(async (signal?: AbortSignal) => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const response = await fetch("/api/mahasiswa/catalog/directory", { signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Gagal memuat direktori akademik"));
      }
      if (data && Array.isArray(data.faculties)) {
        setDirectory(data as CatalogDirectory);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setDirectoryError(
        err instanceof Error ? err.message : "Gagal memuat direktori akademik"
      );
    } finally {
      if (!signal?.aborted) setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchDirectory(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [fetchDirectory]);

  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const fetchCourses = useCallback(
    async (signal?: AbortSignal) => {
      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (facultyId) params.set("facultyId", facultyId);
        if (studyProgramId) params.set("studyProgramId", studyProgramId);
        if (enrollment !== "all") params.set("enrollment", enrollment);

        const response = await fetch(`/api/mahasiswa/courses/available?${params}`, {
          signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(extractErrorMessage(data, "Gagal memuat katalog course"));
        }
        if (Array.isArray(data)) {
          setCourses(data as CatalogCourse[]);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setCourses([]);
        setCoursesError(
          err instanceof Error ? err.message : "Gagal memuat katalog course"
        );
      } finally {
        if (!signal?.aborted) setCoursesLoading(false);
      }
    },
    [search, facultyId, studyProgramId, enrollment]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchCourses(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [fetchCourses]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (facultyId) params.set("facultyId", facultyId);
    if (studyProgramId) params.set("studyProgramId", studyProgramId);
    if (enrollment !== "all") params.set("enrollment", enrollment);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `/mahasiswa/catalog?${query}` : "/mahasiswa/catalog"
    );
  }, [search, facultyId, studyProgramId, enrollment]);

  const effectiveFacultyId = useMemo(() => {
    if (facultyId) return facultyId;
    if (!studyProgramId || !directory) return "";
    const owner = directory.faculties.find((faculty) =>
      faculty.studyPrograms.some((program) => program.id === studyProgramId)
    );
    return owner?.id ?? "";
  }, [directory, facultyId, studyProgramId]);

  const selectedFaculty = useMemo(
    () =>
      directory?.faculties.find((faculty) => faculty.id === effectiveFacultyId) ?? null,
    [directory, effectiveFacultyId]
  );

  const availableStudyPrograms = useMemo(() => {
    if (!directory) return [];
    if (selectedFaculty) {
      return selectedFaculty.studyPrograms.map((program) => ({
        ...program,
        facultyId: selectedFaculty.id,
        facultyName: formatAcademicUnitName(selectedFaculty.name),
      }));
    }
    return directory.faculties.flatMap((faculty) =>
      faculty.studyPrograms.map((program) => ({
        ...program,
        facultyId: faculty.id,
        facultyName: formatAcademicUnitName(faculty.name),
      }))
    );
  }, [directory, selectedFaculty]);

  const selectedProgram = useMemo(
    () =>
      availableStudyPrograms.find((program) => program.id === studyProgramId) ?? null,
    [availableStudyPrograms, studyProgramId]
  );

  const hasActiveFilters = Boolean(
    search || effectiveFacultyId || studyProgramId || enrollment !== "all"
  );

  function resetAllFilters() {
    setSearchInput("");
    setSearch("");
    setFacultyId("");
    setStudyProgramId("");
    setEnrollment("all");
  }

  function openEnrollDialog(course: CatalogCourse) {
    setSelectedCourse(course);
    setEnrollmentKey("");
    setEnrollError(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setSelectedCourse(null);
      setEnrollmentKey("");
      setEnrollError(null);
      setSubmitting(false);
    }
  }

  async function handleEnrollSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;

    const trimmedKey = enrollmentKey.trim();
    if (!trimmedKey) {
      setEnrollError("Masukkan enrollment key terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    setEnrollError(null);

    try {
      const response = await fetch("/api/mahasiswa/courses/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          enrollmentKey: trimmedKey,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Gagal bergabung ke course"));
      }

      const enrolledCourseId = selectedCourse.id;
      const enrolledTitle = selectedCourse.title;
      setCourses((prev) =>
        prev.map((item) =>
          item.id === enrolledCourseId ? { ...item, isEnrolled: true } : item
        )
      );
      toast.success(`Berhasil bergabung ke ${enrolledTitle}`);
      handleDialogOpenChange(false);
      router.push(`/mahasiswa/courses/${enrolledCourseId}`);
    } catch (err) {
      setEnrollError(
        err instanceof Error ? err.message : "Gagal bergabung ke course"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Katalog Course</h1>
        <p className="text-muted-foreground">
          Jelajahi mata kuliah berdasarkan fakultas, sekolah, atau program studi, lalu masukkan
          enrollment key untuk bergabung.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:block">
          <Card className="border-border/50 py-0 lg:sticky lg:top-6">
            <CardHeader className="border-b px-4 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="size-4 text-brand" aria-hidden="true" />
                Direktori Akademik
              </CardTitle>
              <CardDescription className="text-xs">
                Pilih fakultas, sekolah, atau prodi
              </CardDescription>
            </CardHeader>

            <CardContent className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3">
              {directoryLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : directoryError ? (
                <div className="flex flex-col items-start gap-3 p-2">
                  <p className="text-xs text-destructive">{directoryError}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void fetchDirectory()}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Coba Lagi
                  </Button>
                </div>
              ) : !directory || directory.faculties.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  Belum ada data fakultas atau program studi.
                </p>
              ) : (
                <nav aria-label="Direktori fakultas dan program studi" className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFacultyId("");
                      setStudyProgramId("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      !effectiveFacultyId && !studyProgramId
                        ? "bg-brand/15 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="truncate">Semua Mata Kuliah</span>
                    <span className="shrink-0 text-xs tabular-nums">
                      {directory.totalCourses}
                    </span>
                  </button>

                  {directory.faculties.map((faculty) => {
                    const isFacultySelected = effectiveFacultyId === faculty.id;
                    const facultyLabel = formatAcademicUnitName(faculty.name);

                    return (
                      <div key={faculty.id} className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (isFacultySelected && !studyProgramId) {
                              setFacultyId("");
                              setStudyProgramId("");
                            } else {
                              setFacultyId(faculty.id);
                              setStudyProgramId("");
                            }
                          }}
                          aria-expanded={isFacultySelected}
                          className={cn(
                            "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            isFacultySelected
                              ? "bg-brand/15 font-semibold text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span className="flex min-w-0 items-start gap-1.5">
                            <ChevronRight
                              className={cn(
                                "mt-0.5 size-3.5 shrink-0 transition-transform",
                                isFacultySelected && "rotate-90"
                              )}
                              aria-hidden="true"
                            />
                            <span className="break-words leading-snug">{facultyLabel}</span>
                          </span>
                          <span className="shrink-0 pt-0.5 text-xs tabular-nums">
                            {faculty.courseCount}
                          </span>
                        </button>

                        {isFacultySelected && faculty.studyPrograms.length > 0 && (
                          <div className="ml-4 flex flex-col gap-1 border-l pl-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFacultyId(faculty.id);
                                setStudyProgramId("");
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                                !studyProgramId
                                  ? "bg-muted font-semibold text-foreground"
                                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              )}
                            >
                              <span className="truncate">Semua Prodi</span>
                              <span className="shrink-0 tabular-nums">{faculty.courseCount}</span>
                            </button>

                            {faculty.studyPrograms.map((program) => {
                              const isProgramSelected = studyProgramId === program.id;
                              return (
                                <button
                                  key={program.id}
                                  type="button"
                                  onClick={() => {
                                    setFacultyId(faculty.id);
                                    setStudyProgramId(program.id);
                                  }}
                                  className={cn(
                                    "flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                                    isProgramSelected
                                      ? "bg-brand text-black font-semibold"
                                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                  )}
                                >
                                  <span className="break-words leading-snug">{program.name}</span>
                                  <span className="shrink-0 tabular-nums">{program.courseCount}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="catalog-search-input"
                  placeholder="Cari judul, kode MK, dosen, fakultas, atau prodi..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSearch(searchInput.trim());
                    }
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

              <ToggleGroup
                type="single"
                variant="outline"
                value={enrollment}
                onValueChange={(value) => {
                  if (value) setEnrollment(value as AvailableCoursesEnrollmentFilter);
                }}
                aria-label="Filter status pendaftaran"
                className="w-full md:w-auto"
              >
                {ENROLLMENT_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="flex-1 px-3 md:flex-initial"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              <Select
                value={effectiveFacultyId || "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFacultyId("");
                    setStudyProgramId("");
                  } else {
                    setFacultyId(value);
                    setStudyProgramId("");
                  }
                }}
                disabled={directoryLoading || Boolean(directoryError)}
              >
                <SelectTrigger aria-label="Filter fakultas atau sekolah">
                  <SelectValue placeholder="Semua Fakultas / Sekolah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Semua Fakultas / Sekolah</SelectItem>
                    {directory?.faculties.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id}>
                        {formatAcademicUnitName(faculty.name)} ({faculty.courseCount})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={studyProgramId || "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setStudyProgramId("");
                    return;
                  }
                  const matched = availableStudyPrograms.find((program) => program.id === value);
                  if (matched && !facultyId) {
                    setFacultyId(matched.facultyId);
                  }
                  setStudyProgramId(value);
                }}
                disabled={directoryLoading || Boolean(directoryError)}
              >
                <SelectTrigger aria-label="Filter program studi">
                  <SelectValue placeholder="Semua Program Studi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Semua Program Studi</SelectItem>
                    {availableStudyPrograms.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {selectedFaculty
                          ? `${program.name} (${program.courseCount})`
                          : `${program.name} - ${program.facultyName} (${program.courseCount})`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              {!coursesLoading && !coursesError && (
                <span>Menampilkan {courses.length} mata kuliah</span>
              )}
              {selectedFaculty && (
                <Badge variant="secondary" className="gap-1">
                  {formatAcademicUnitName(selectedFaculty.name)}
                  <button
                    type="button"
                    aria-label="Hapus filter fakultas"
                    onClick={() => {
                      setFacultyId("");
                      setStudyProgramId("");
                    }}
                    className="ml-0.5 rounded-full hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {selectedProgram && (
                <Badge variant="secondary" className="gap-1">
                  {selectedProgram.name}
                  <button
                    type="button"
                    aria-label="Hapus filter program studi"
                    onClick={() => setStudyProgramId("")}
                    className="ml-0.5 rounded-full hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {enrollment !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {enrollment === "not_enrolled" ? "Belum Diikuti" : "Sudah Diikuti"}
                  <button
                    type="button"
                    aria-label="Hapus filter status"
                    onClick={() => setEnrollment("all")}
                    className="ml-0.5 rounded-full hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw data-icon="inline-start" />
                Reset Filter
              </Button>
            )}
          </div>

          {coursesLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="gap-0 overflow-hidden border-border/50 py-0">
                  <div className="relative aspect-[1.55/1]">
                    <Skeleton className="size-full rounded-none" />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/65 to-transparent" />
                  </div>
                  <CardContent className="flex min-h-44 flex-col gap-3 p-5 pt-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="mt-auto flex flex-col gap-2 pt-2">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : coursesError ? (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <p className="text-sm font-medium text-destructive">{coursesError}</p>
                <Button type="button" variant="outline" onClick={() => void fetchCourses()}>
                  <RotateCcw data-icon="inline-start" />
                  Coba Lagi
                </Button>
              </CardContent>
            </Card>
          ) : courses.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                {hasActiveFilters ? (
                  <BookOpen
                    className="mb-4 size-12 text-muted-foreground/50"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                ) : (
                  <Compass
                    className="mb-4 size-12 text-muted-foreground/50"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                )}
                <p className="font-medium text-muted-foreground">
                  {hasActiveFilters
                    ? "Tidak ada course yang cocok dengan filter saat ini"
                    : "Belum ada course yang dipublikasikan di katalog."}
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground/70">
                  {hasActiveFilters
                    ? "Ubah kata kunci pencarian, kategori fakultas/prodi, atau status pendaftaran."
                    : "Course yang sudah dipublikasikan oleh admin akan tampil di sini."}
                </p>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={resetAllFilters}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Reset Filter
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <CatalogCourseCard
                  key={course.id}
                  course={course}
                  onSelectForEnroll={openEnrollDialog}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CatalogEnrollDialog
        course={selectedCourse}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        enrollmentKey={enrollmentKey}
        onEnrollmentKeyChange={(value) => {
          setEnrollmentKey(value);
          if (enrollError) setEnrollError(null);
        }}
        enrollError={enrollError}
        submitting={submitting}
        onSubmit={handleEnrollSubmit}
      />
    </div>
  );
}
