"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Building2,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Faculty {
  id: string;
  name: string;
  code: string | null;
  studyPrograms: { id: string; name: string }[];
}

interface StudyProgram {
  id: string;
  facultyId: string;
  name: string;
  code: string | null;
  source: "SIAT" | "PIPP" | null;
  createdAt: string;
  faculty: {
    id: string;
    name: string;
    code: string | null;
  };
  _count: {
    courses: number;
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === "AbortError"
    : typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name?: unknown }).name === "AbortError";
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  const data: unknown = await res.json().catch(() => null);
  if (typeof data !== "object" || data === null) return fallback;
  const error = (data as { error?: unknown }).error;
  if (Array.isArray(error)) {
    const messages = error
      .map((issue) =>
        typeof issue === "object" && issue !== null && "message" in issue
          ? String((issue as { message: unknown }).message)
          : ""
      )
      .filter(Boolean);
    return messages.length > 0 ? messages.join(", ") : fallback;
  }
  return typeof error === "string" && error.trim() ? error : fallback;
}

function renderSourceBadge(source: StudyProgram["source"]) {
  if (source === "SIAT") {
    return <Badge variant="default">SIAT</Badge>;
  }
  if (source === "PIPP") {
    return <Badge variant="secondary">PIPP</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Manual
    </Badge>
  );
}

export default function StudyProgramsPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [facultyFilter, setFacultyFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [facultiesReloadKey, setFacultiesReloadKey] = useState(0);

  // Create/Edit Study Program Dialog
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<StudyProgram | null>(null);
  const [programFacultyId, setProgramFacultyId] = useState("");
  const [programName, setProgramName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [programErrors, setProgramErrors] = useState<{
    facultyId?: string;
    name?: string;
  }>({});
  const [submittingProgram, setSubmittingProgram] = useState(false);

  // Create Faculty Dialog
  const [facultyDialogOpen, setFacultyDialogOpen] = useState(false);
  const [facultyName, setFacultyName] = useState("");
  const [facultyError, setFacultyError] = useState<string | null>(null);
  const [submittingFaculty, setSubmittingFaculty] = useState(false);

  // Delete Confirmation AlertDialog
  const [deleteTarget, setDeleteTarget] = useState<StudyProgram | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFaculties() {
      try {
        const res = await fetch("/api/admin/academic/faculties", {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: unknown = await res.json().catch(() => null);
        if (Array.isArray(data)) {
          setFaculties(data as Faculty[]);
        }
      } catch (err) {
        if (!isAbortError(err)) {
          // Faculty filter remains usable with default "Semua Fakultas" option.
        }
      }
    }

    void loadFaculties();
    return () => controller.abort();
  }, [reloadKey, facultiesReloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudyPrograms() {
      setLoading(true);
      setLoadError(null);

      const params = new URLSearchParams();
      if (facultyFilter !== "all") {
        params.set("facultyId", facultyFilter);
      }
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const query = params.toString();
      const url = query
        ? `/api/admin/academic/study-programs?${query}`
        : "/api/admin/academic/study-programs";

      try {
        const res = await fetch(url, { signal: controller.signal });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Gagal memuat daftar program studi";
          throw new Error(message);
        }
        if (Array.isArray(data)) {
          setStudyPrograms(data as StudyProgram[]);
        } else {
          setStudyPrograms([]);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        setStudyPrograms([]);
        setLoadError(
          err instanceof Error ? err.message : "Gagal memuat daftar program studi"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadStudyPrograms();
    return () => controller.abort();
  }, [facultyFilter, search, reloadKey]);

  const hasActiveFilters =
    facultyFilter !== "all" || search !== "" || searchInput !== "";
  const hasCommittedFilters =
    facultyFilter !== "all" || search.trim() !== "";

  function handleReset() {
    setFacultyFilter("all");
    setSearchInput("");
    setSearch("");
  }

  function openCreateFaculty() {
    setFacultyName("");
    setFacultyError(null);
    setFacultyDialogOpen(true);
  }

  function openCreateProgram() {
    setEditingProgram(null);
    setProgramFacultyId(facultyFilter !== "all" ? facultyFilter : "");
    setProgramName("");
    setProgramCode("");
    setProgramErrors({});
    setProgramDialogOpen(true);
  }

  function openEditProgram(program: StudyProgram) {
    setEditingProgram(program);
    setProgramFacultyId(program.facultyId);
    setProgramName(program.name);
    setProgramCode(program.code ?? "");
    setProgramErrors({});
    setProgramDialogOpen(true);
  }

  async function handleCreateFaculty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = facultyName.trim();
    if (!trimmedName) {
      const msg = "Nama fakultas wajib diisi.";
      setFacultyError(msg);
      toast.error(msg);
      return;
    }

    setFacultyError(null);
    setSubmittingFaculty(true);
    try {
      const res = await fetch("/api/admin/academic/faculties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Gagal menambahkan fakultas"));
      }
      toast.success("Fakultas berhasil ditambahkan");
      setFacultyDialogOpen(false);
      setFacultyName("");
      setFacultiesReloadKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menambahkan fakultas"
      );
    } finally {
      setSubmittingFaculty(false);
    }
  }

  async function handleSubmitProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = programName.trim();
    const trimmedCode = programCode.trim().toUpperCase();
    const nextErrors: { facultyId?: string; name?: string } = {};

    if (!programFacultyId) {
      nextErrors.facultyId = "Fakultas wajib dipilih.";
    }
    if (!trimmedName) {
      nextErrors.name = "Nama program studi wajib diisi.";
    }

    if (nextErrors.facultyId || nextErrors.name) {
      setProgramErrors(nextErrors);
      if (nextErrors.facultyId) toast.error(nextErrors.facultyId);
      if (nextErrors.name) toast.error(nextErrors.name);
      return;
    }

    setProgramErrors({});
    setSubmittingProgram(true);
    try {
      if (editingProgram) {
        const res = await fetch(
          `/api/admin/academic/study-programs/${editingProgram.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              facultyId: programFacultyId,
              name: trimmedName,
              code: trimmedCode || null,
            }),
          }
        );
        if (!res.ok) {
          throw new Error(
            await getErrorMessage(res, "Gagal memperbarui program studi")
          );
        }
        toast.success("Program studi berhasil diperbarui");
      } else {
        const res = await fetch("/api/admin/academic/study-programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facultyId: programFacultyId,
            name: trimmedName,
            ...(trimmedCode ? { code: trimmedCode } : {}),
          }),
        });
        if (!res.ok) {
          throw new Error(
            await getErrorMessage(res, "Gagal menambahkan program studi")
          );
        }
        toast.success("Program studi berhasil ditambahkan");
      }

      setProgramDialogOpen(false);
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan program studi"
      );
    } finally {
      setSubmittingProgram(false);
    }
  }

  async function handleDeleteProgram() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/academic/study-programs/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Gagal menghapus program studi")
        );
      }
      toast.success("Program studi berhasil dihapus");
      setDeleteTarget(null);
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus program studi"
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Program Studi</h1>
          <p className="text-muted-foreground">
            Daftar seluruh program studi dan fakultas yang tersimpan di database.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={openCreateFaculty}
              className="gap-2"
            >
              <Plus data-icon="inline-start" />
              Tambah Fakultas
            </Button>
            <Button
              type="button"
              onClick={openCreateProgram}
              className="gap-2 bg-brand text-black hover:bg-brand/90"
            >
              <Plus data-icon="inline-start" />
              Tambah Program Studi
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
              <GraduationCap className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Program Studi:</span>
              <span className="font-semibold tabular-nums">
                {loading ? "—" : studyPrograms.length.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
              <Building2 className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fakultas:</span>
              <span className="font-semibold tabular-nums">
                {faculties.length.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama prodi, kode prodi, atau fakultas..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
              }
            }}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Hapus pencarian"
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

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={facultyFilter} onValueChange={setFacultyFilter}>
            <SelectTrigger className="flex-1 sm:w-[260px]">
              <SelectValue placeholder="Semua Fakultas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Fakultas</SelectItem>
              {faculties.map((faculty) => (
                <SelectItem key={faculty.id} value={faculty.id}>
                  {faculty.name} ({faculty.studyPrograms.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="shrink-0 gap-2"
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">{loadError}</p>
              <p className="text-xs text-muted-foreground">
                Periksa koneksi atau coba muat ulang data program studi.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="shrink-0 self-start sm:self-auto"
          >
            Coba lagi
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Kode</TableHead>
              <TableHead>Program Studi</TableHead>
              <TableHead>Fakultas</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead className="text-center">Mata Kuliah</TableHead>
              <TableHead className="w-[80px] pr-6 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell
                      key={j}
                      className={
                        j === 0 ? "pl-6" : j === 5 ? "pr-6" : undefined
                      }
                    >
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : loadError ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Data program studi gagal dimuat.
                </TableCell>
              </TableRow>
            ) : studyPrograms.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {hasCommittedFilters
                    ? "Tidak ada program studi yang sesuai dengan filter."
                    : "Belum ada data program studi di database."}
                </TableCell>
              </TableRow>
            ) : (
              studyPrograms.map((program) => (
                <TableRow
                  key={program.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell className="pl-6">
                    {program.code ? (
                      <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {program.code}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{program.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{program.faculty.name}</span>
                      {program.faculty.code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {program.faculty.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{renderSourceBadge(program.source)}</TableCell>
                  <TableCell className="text-center font-medium tabular-nums">
                    {program._count.courses.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Aksi untuk ${program.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => openEditProgram(program)}
                          >
                            <Pencil data-icon="inline-start" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(program)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 data-icon="inline-start" />
                            Hapus
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

      {/* Create Faculty Dialog */}
      <Dialog
        open={facultyDialogOpen}
        onOpenChange={(open) => {
          if (!submittingFaculty) setFacultyDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[460px] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl">Tambah Fakultas</DialogTitle>
            <DialogDescription>
              Tambahkan fakultas baru agar dapat dipilih saat membuat program studi.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFaculty}>
            <div className="px-6 py-5">
              <div className="grid gap-2">
                <Label htmlFor="faculty-name">Nama Fakultas</Label>
                <Input
                  id="faculty-name"
                  value={facultyName}
                  maxLength={150}
                  onChange={(e) => {
                    setFacultyName(e.target.value);
                    if (facultyError) setFacultyError(null);
                  }}
                  placeholder="Contoh: Fakultas Teknik Elektro"
                  aria-invalid={!!facultyError}
                />
                {facultyError && (
                  <p className="text-xs text-destructive">{facultyError}</p>
                )}
              </div>
            </div>
            <DialogFooter className="m-0 px-6 py-4 border-t bg-muted/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFacultyDialogOpen(false)}
                disabled={submittingFaculty}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingFaculty}
                className="bg-brand text-black hover:bg-brand/90"
              >
                {submittingFaculty && (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Study Program Dialog */}
      <Dialog
        open={programDialogOpen}
        onOpenChange={(open) => {
          if (!submittingProgram) setProgramDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-6 border-b bg-muted/30">
            <DialogTitle className="text-xl">
              {editingProgram ? "Edit Program Studi" : "Tambah Program Studi"}
            </DialogTitle>
            <DialogDescription>
              {editingProgram
                ? "Perbarui fakultas, nama, atau kode program studi."
                : "Tambahkan program studi baru ke referensi akademik."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitProgram}>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="grid gap-5 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="program-faculty">Fakultas</Label>
                  <Select
                    value={programFacultyId}
                    onValueChange={(value) => {
                      setProgramFacultyId(value);
                      if (programErrors.facultyId) {
                        setProgramErrors((prev) => ({
                          ...prev,
                          facultyId: undefined,
                        }));
                      }
                    }}
                    disabled={faculties.length === 0}
                  >
                    <SelectTrigger
                      id="program-faculty"
                      aria-invalid={!!programErrors.facultyId}
                    >
                      <SelectValue placeholder="Pilih fakultas" />
                    </SelectTrigger>
                    <SelectContent>
                      {faculties.map((faculty) => (
                        <SelectItem key={faculty.id} value={faculty.id}>
                          {faculty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {programErrors.facultyId && (
                    <p className="text-xs text-destructive">
                      {programErrors.facultyId}
                    </p>
                  )}
                  {faculties.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada fakultas tersedia. Tambahkan fakultas terlebih
                      dahulu menggunakan tombol &quot;Tambah Fakultas&quot;.
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="program-name">Nama Program Studi</Label>
                  <Input
                    id="program-name"
                    value={programName}
                    maxLength={150}
                    onChange={(e) => {
                      setProgramName(e.target.value);
                      if (programErrors.name) {
                        setProgramErrors((prev) => ({
                          ...prev,
                          name: undefined,
                        }));
                      }
                    }}
                    placeholder="Contoh: Teknik Informatika"
                    aria-invalid={!!programErrors.name}
                  />
                  {programErrors.name && (
                    <p className="text-xs text-destructive">
                      {programErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="program-code">
                    Kode Program Studi{" "}
                    <span className="text-muted-foreground font-normal text-xs">
                      (opsional)
                    </span>
                  </Label>
                  <Input
                    id="program-code"
                    value={programCode}
                    maxLength={20}
                    onChange={(e) =>
                      setProgramCode(e.target.value.toUpperCase())
                    }
                    placeholder="Contoh: IF atau TIP (opsional, 2–20 karakter)"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gunakan 2–20 huruf kapital, angka, tanda hubung (-), atau
                    garis bawah (_). Kosongkan untuk menghapus atau melewati kode.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="m-0 px-6 py-4 border-t bg-muted/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProgramDialogOpen(false)}
                disabled={submittingProgram}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingProgram}
                className="bg-brand text-black hover:bg-brand/90"
              >
                {submittingProgram && (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                )}
                {editingProgram ? "Simpan" : "Tambah Program Studi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Program Studi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus program studi{" "}
              <strong>{deleteTarget?.name}</strong> dari fakultas{" "}
              <strong>{deleteTarget?.faculty.name}</strong>? Tindakan ini tidak
              dapat dibatalkan.
              {deleteTarget && deleteTarget._count.courses > 0 && (
                <span className="mt-2 block rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Program studi ini sedang terhubung dengan{" "}
                  {deleteTarget._count.courses.toLocaleString("id-ID")} mata
                  kuliah. Penghapusan akan ditolak oleh sistem selama masih
                  digunakan.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteProgram();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
