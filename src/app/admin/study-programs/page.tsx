"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Building2,
  GraduationCap,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

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
  }, []);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Program Studi</h1>
          <p className="text-muted-foreground">
            Daftar seluruh program studi dan fakultas yang tersimpan di database.
          </p>
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
              <TableHead className="pr-6 text-center">Mata Kuliah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j} className={j === 0 ? "pl-6" : j === 4 ? "pr-6" : undefined}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Data program studi gagal dimuat.
                </TableCell>
              </TableRow>
            ) : studyPrograms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
                  <TableCell className="pr-6 text-center font-medium tabular-nums">
                    {program._count.courses.toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
