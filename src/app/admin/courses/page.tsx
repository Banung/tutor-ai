"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  Loader2,
  Eye,
  Copy,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  Search,
  X,
  BookOpen,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

type CatalogStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Course {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  learningOutcomes: string | null;
  coverImage: string | null;
  enrollmentKey: string;
  isActive: boolean;
  hasArModule: boolean;
  catalogStatus: CatalogStatus;
  createdAt: string;
  studyProgramId: string | null;
  studyProgram: {
    id: string;
    name: string;
    faculty: { id: string; name: string };
  } | null;
  creator: { id: string; name: string };
  _count: { instructors: number; enrollments: number };
}

interface Faculty {
  id: string;
  name: string;
  studyPrograms: { id: string; name: string }[];
}

type CourseForm = {
  title: string;
  courseCode: string;
  description: string;
  learningOutcomes: string;
  studyProgramId: string;
  hasArModule: boolean;
};

const EMPTY_FORM: CourseForm = {
  title: "",
  courseCode: "",
  description: "",
  learningOutcomes: "",
  studyProgramId: "",
  hasArModule: false,
};

const CATALOG_LABEL: Record<CatalogStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Dipublikasikan",
  ARCHIVED: "Diarsipkan",
};

const CATALOG_CLASS: Record<CatalogStatus, string> = {
  DRAFT: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

async function getErrorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  const error = data?.error;
  if (Array.isArray(error)) {
    return error.map((issue: { message?: string }) => issue.message).filter(Boolean).join(", ") || fallback;
  }
  return typeof error === "string" ? error : fallback;
}

function catalogBadge(status: CatalogStatus) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATALOG_CLASS[status]}`}
    >
      {CATALOG_LABEL[status]}
    </span>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [formFacultyId, setFormFacultyId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Archive dialog
  const [archiveTarget, setArchiveTarget] = useState<Course | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Reference dialog
  const [refsOpen, setRefsOpen] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState("");
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramFacultyId, setNewProgramFacultyId] = useState("");
  const [savingFaculty, setSavingFaculty] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);

  // Custom Cursor-Following Tooltip State
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const fetchReferences = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/academic/faculties");
      const data = await res.json();
      if (Array.isArray(data)) setFaculties(data);
    } catch {
      // Reference data is optional for legacy entries.
    }
  }, []);

  const fetchCourses = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (facultyFilter !== "all") params.set("facultyId", facultyFilter);
    if (programFilter !== "all") params.set("studyProgramId", programFilter);
    if (statusFilter !== "all") params.set("catalogStatus", statusFilter);

    fetch(`/api/admin/courses?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          throw new Error(
            Array.isArray(data?.error)
              ? "Filter atau permintaan tidak valid"
              : data?.error || "Gagal memuat daftar course"
          );
        }
        if (Array.isArray(data)) setCourses(data);
      })
      .catch((err) => {
        setCourses([]);
        setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar course");
      })
      .finally(() => setLoading(false));
  }, [search, facultyFilter, programFilter, statusFilter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  const filterPrograms = useMemo(() => {
    const source =
      facultyFilter === "all"
        ? faculties
        : faculties.filter((faculty) => faculty.id === facultyFilter);
    return source.flatMap((faculty) =>
      faculty.studyPrograms.map((program) => ({
        ...program,
        facultyName: faculty.name,
      }))
    );
  }, [faculties, facultyFilter]);

  const formPrograms = useMemo(() => {
    if (!formFacultyId) return [];
    return faculties.find((faculty) => faculty.id === formFacultyId)?.studyPrograms ?? [];
  }, [faculties, formFacultyId]);

  function openCreate() {
    setEditingCourse(null);
    setForm(EMPTY_FORM);
    setFormFacultyId("");
    setCoverFile(null);
    setDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditingCourse(course);
    setForm({
      title: course.title,
      courseCode: course.courseCode ?? "",
      description: course.description ?? "",
      learningOutcomes: course.learningOutcomes ?? "",
      studyProgramId: course.studyProgramId ?? "",
      hasArModule: course.hasArModule,
    });
    setFormFacultyId(course.studyProgram?.faculty.id ?? "");
    setCoverFile(null);
    setDialogOpen(true);
  }

  async function uploadCover(courseId: string) {
    if (!coverFile) return true;
    const body = new FormData();
    body.set("file", coverFile);
    const res = await fetch(`/api/admin/courses/${courseId}/cover`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      toast.error(await getErrorMessage(res, "Course tersimpan, tetapi cover gagal diunggah."));
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const shared = {
        title: form.title,
        description: form.description || null,
        learningOutcomes: form.learningOutcomes || null,
        studyProgramId: form.studyProgramId || null,
        hasArModule: form.hasArModule,
      };

      if (editingCourse) {
        const body: Record<string, unknown> = { ...shared };
        if (form.courseCode.trim()) body.courseCode = form.courseCode;

        const res = await fetch(`/api/admin/courses/${editingCourse.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await getErrorMessage(res, "Gagal memperbarui course"));
        }
        await uploadCover(editingCourse.id);
        toast.success("Course berhasil diperbarui");
      } else {
        const res = await fetch("/api/admin/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...shared, courseCode: form.courseCode }),
        });
        if (!res.ok) {
          throw new Error(await getErrorMessage(res, "Gagal membuat course"));
        }
        const created = (await res.json()) as { id: string };
        await uploadCover(created.id);
        toast.success("Course berhasil dibuat sebagai draft");
      }

      setDialogOpen(false);
      fetchCourses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(course: Course) {
    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !course.isActive }),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, "Gagal mengubah status"));
      toast.success(course.isActive ? "Akses course dinonaktifkan" : "Akses course diaktifkan");
      fetchCourses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/courses/${archiveTarget.id}/archive`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Gagal mengarsipkan"));
      }
      toast.success("Course berhasil diarsipkan");
      setArchiveTarget(null);
      fetchCourses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan course");
    } finally {
      setArchiving(false);
    }
  }

  async function handleCreateFaculty() {
    if (!newFacultyName.trim()) return;
    setSavingFaculty(true);
    try {
      const res = await fetch("/api/admin/academic/faculties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFacultyName }),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, "Gagal membuat fakultas"));
      const created = (await res.json()) as { id: string; name: string };
      setNewFacultyName("");
      setNewProgramFacultyId(created.id);
      await fetchReferences();
      toast.success("Fakultas ditambahkan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat fakultas");
    } finally {
      setSavingFaculty(false);
    }
  }

  async function handleCreateProgram() {
    if (!newProgramName.trim() || !newProgramFacultyId) return;
    setSavingProgram(true);
    try {
      const res = await fetch("/api/admin/academic/study-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyId: newProgramFacultyId,
          name: newProgramName,
        }),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, "Gagal membuat program studi"));
      setNewProgramName("");
      await fetchReferences();
      toast.success("Program studi ditambahkan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat program studi");
    } finally {
      setSavingProgram(false);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("Enrollment key disalin");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Katalog Mata Kuliah</h1>
          <p className="text-muted-foreground">
            Kelola profil, metadata akademik, dan status katalog mata kuliah
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-brand text-black hover:bg-brand/90">
          <Plus data-icon="inline-start" />
          Tambah Course
        </Button>
      </div>

      {/* Filters/Search */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_220px_170px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari judul, kode, atau enrollment key..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput);
            }}
            className="pl-9"
          />
          {searchInput && (
            <button
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

        <Select
          value={facultyFilter}
          onValueChange={(value) => {
            setFacultyFilter(value);
            setProgramFilter("all");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Fakultas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua fakultas</SelectItem>
            {faculties.map((faculty) => (
              <SelectItem key={faculty.id} value={faculty.id}>
                {faculty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Program studi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua program studi</SelectItem>
            {filterPrograms.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {facultyFilter === "all"
                  ? `${program.name} — ${program.facultyName}`
                  : program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status katalog" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Dipublikasikan</SelectItem>
            <SelectItem value="ARCHIVED">Diarsipkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Mata Kuliah</TableHead>
              <TableHead>Enrollment Key</TableHead>
              <TableHead className="text-center">Dosen</TableHead>
              <TableHead className="text-center">Mahasiswa</TableHead>
              <TableHead>Katalog</TableHead>
              <TableHead>Akses</TableHead>
              <TableHead className="w-[80px] text-right pr-6">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="mb-2 text-sm text-destructive">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={fetchCourses}>
                    Coba lagi
                  </Button>
                </TableCell>
              </TableRow>
            ) : courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Tidak ada course yang cocok dengan filter
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow
                  key={course.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => router.push(`/admin/courses/${course.id}`)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onMouseMove={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    const isInteractive = (e.target as HTMLElement).closest(".no-tooltip");
                    setShowTooltip(!isInteractive);
                  }}
                >
                  <TableCell className="pl-6 max-w-[220px] sm:max-w-[320px]">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate" title={course.title}>{course.title}</p>
                        {course.courseCode && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {course.courseCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {course.studyProgram
                          ? `${course.studyProgram.name} · ${course.studyProgram.faculty.name}`
                          : "Referensi akademik belum diisi"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="no-tooltip">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyKey(course.enrollmentKey);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs transition-colors hover:bg-muted"
                    >
                      <KeyRound className="size-3 text-brand" />
                      {course.enrollmentKey}
                      <Copy className="size-3 text-muted-foreground" />
                    </button>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {course._count.instructors}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {course._count.enrollments}
                  </TableCell>
                  <TableCell>{catalogBadge(course.catalogStatus)}</TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${course.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {course.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right pr-6 no-tooltip"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => router.push(`/admin/courses/${course.id}`)}>
                            <Eye data-icon="inline-start" />
                            Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(course)}>
                            <Pencil data-icon="inline-start" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(course)}>
                            {course.isActive ? (
                              <>
                                <ToggleLeft data-icon="inline-start" />
                                Nonaktifkan akses
                              </>
                            ) : (
                              <>
                                <ToggleRight data-icon="inline-start" />
                                Aktifkan akses
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => setArchiveTarget(course)}
                            disabled={course.catalogStatus === "ARCHIVED"}
                          >
                            <Archive data-icon="inline-start" />
                            Arsipkan
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Floating Cursor Tooltip (Mimics Shadcn) */}
      {showTooltip && (
        <div
          className="fixed z-50 pointer-events-none flex items-center gap-2 bg-white text-brand px-3 py-1.5 font-medium border border-border/50 shadow-md rounded-md animate-in fade-in zoom-in-95 duration-100 text-xs"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
          }}
        >
          <Eye className="size-4" />
          Lihat Detail
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl">
              {editingCourse ? "Edit Course" : "Tambah Course Baru"}
            </DialogTitle>
            <DialogDescription>
              {editingCourse
                ? "Perbarui profil dan metadata akademik course ini."
                : "Entri baru disimpan sebagai draft. Enrollment key otomatis dibuat."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="grid gap-5 py-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <div className="grid gap-2">
                  <Label htmlFor="title">Nama Mata Kuliah</Label>
                  <Input
                    id="title"
                    value={form.title}
                    maxLength={150}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Nama mata kuliah"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="courseCode">Kode MK</Label>
                  <Input
                    id="courseCode"
                    value={form.courseCode}
                    maxLength={12}
                    onChange={(e) =>
                      setForm({ ...form, courseCode: e.target.value.toUpperCase() })
                    }
                    placeholder="IF1234"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingCourse && !editingCourse.courseCode
                      ? "Opsional untuk entri lama."
                      : "Wajib, 4–12 huruf/angka."}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">
                  Deskripsi <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
                </Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Deskripsi singkat course"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="learningOutcomes">
                  Capaian Pembelajaran{" "}
                  <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
                </Label>
                <Textarea
                  id="learningOutcomes"
                  value={form.learningOutcomes}
                  onChange={(e) => setForm({ ...form, learningOutcomes: e.target.value })}
                  placeholder="Capaian pembelajaran lulusan mata kuliah"
                  rows={3}
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Referensi Akademik</p>
                    <p className="text-xs text-muted-foreground">
                      Boleh dikosongkan selama entri masih draft.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRefsOpen(true)}
                  >
                    Tambah Referensi
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Fakultas</Label>
                    <Select
                      value={formFacultyId || "none"}
                      onValueChange={(value) => {
                        setFormFacultyId(value === "none" ? "" : value);
                        setForm({ ...form, studyProgramId: "" });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih fakultas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum ditentukan</SelectItem>
                        {faculties.map((faculty) => (
                          <SelectItem key={faculty.id} value={faculty.id}>
                            {faculty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Program Studi</Label>
                    <Select
                      value={form.studyProgramId || "none"}
                      onValueChange={(value) =>
                        setForm({ ...form, studyProgramId: value === "none" ? "" : value })
                      }
                      disabled={!formFacultyId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih program studi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum ditentukan</SelectItem>
                        {formPrograms.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Checkbox
                  id="hasArModule"
                  checked={form.hasArModule}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, hasArModule: checked === true })
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="hasArModule" className="flex items-center gap-2">
                    <Boxes className="size-4" />
                    Memiliki modul AR
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Metadata katalog saja. Modul AR belum diimplementasikan pada tahap ini.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cover">
                  Gambar Sampul{" "}
                  <span className="text-muted-foreground font-normal text-xs">(opsional)</span>
                </Label>
                {editingCourse?.coverImage && (
                  <div
                    className="h-24 w-full rounded-md border bg-cover bg-center"
                    style={{ backgroundImage: `url("${editingCourse.coverImage}")` }}
                  />
                )}
                <Input
                  id="cover"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  JPG/PNG maksimal 2 MB. Tanpa unggahan, sampul otomatis tetap digunakan.
                </p>
              </div>

              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <BookOpen className="mr-1 inline size-3.5" />
                Dosen pengampu ditugaskan dari halaman detail. Dosen wajib ada sebelum
                entri dapat dipublikasikan pada FR-002.
              </p>
            </div>
          </div>
          <DialogFooter className="m-0 px-6 py-4 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-brand text-black hover:bg-brand/90"
            >
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {editingCourse ? "Simpan" : "Buat Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan Course</AlertDialogTitle>
            <AlertDialogDescription>
              Course <strong>{archiveTarget?.title}</strong> akan ditandai sebagai arsip dan
              hilang dari pencarian mahasiswa. Data enrollment, sesi, materi, dan riwayat
              percakapan tetap tersimpan. Status akses kelas tidak diubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Arsipkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Academic Reference Dialog */}
      <Dialog open={refsOpen} onOpenChange={setRefsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah Referensi Akademik</DialogTitle>
            <DialogDescription>
              Referensi ini dipakai sebagai pilihan pada profil mata kuliah.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-2">
            <div className="grid gap-2">
              <Label htmlFor="newFaculty">Fakultas Baru</Label>
              <div className="flex gap-2">
                <Input
                  id="newFaculty"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  placeholder="Nama fakultas"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateFaculty}
                  disabled={savingFaculty || !newFacultyName.trim()}
                >
                  {savingFaculty && <Loader2 className="animate-spin" />}
                  Tambah
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newProgram">Program Studi Baru</Label>
              <Select
                value={newProgramFacultyId || "none"}
                onValueChange={(value) =>
                  setNewProgramFacultyId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih fakultas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih fakultas</SelectItem>
                  {faculties.map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  id="newProgram"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  placeholder="Nama program studi"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateProgram}
                  disabled={savingProgram || !newProgramName.trim() || !newProgramFacultyId}
                >
                  {savingProgram && <Loader2 className="animate-spin" />}
                  Tambah
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {faculties.length === 0
                ? "Belum ada referensi akademik."
                : faculties
                    .map(
                      (faculty) =>
                        `${faculty.name}: ${faculty.studyPrograms.map((p) => p.name).join(", ") || "belum ada prodi"}`
                    )
                    .join(" · ")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefsOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
