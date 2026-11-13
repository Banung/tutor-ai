"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";

type Source = "SIAT" | "PIPP";
type ImportType = "STUDY_PROGRAMS" | "COURSES" | "LECTURERS";
type Action = "CREATED" | "UPDATED" | "UNCHANGED" | "FAILED" | "CONFLICT";

type PreviewRow = {
  rowNumber: number;
  identity: string;
  action: Action;
  values: Record<string, string | boolean | null>;
  errors: string[];
  note?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
};

type Counts = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  conflict: number;
};

type PreviewCounts = Counts & { columns: string[] };

type Outcome = {
  rowNumber: number;
  identity: string;
  action: Action;
  message: string | null;
};

type Batch = {
  id: string;
  source: Source;
  type: ImportType;
  fileName: string;
  status: string;
  previewCounts: PreviewCounts;
  resultCounts: Counts | null;
  rows: PreviewRow[];
  outcomes: Outcome[];
  canConfirm: boolean;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
};

type HistoryItem = {
  id: string;
  source: Source;
  type: ImportType;
  fileName: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  conflictCount: number;
  createdAt: string;
  confirmedAt: string | null;
  expiresAt: string;
};

const TYPE_LABEL: Record<ImportType, string> = {
  STUDY_PROGRAMS: "Program Studi",
  COURSES: "Mata Kuliah (referensi)",
  LECTURERS: "Dosen (referensi)",
};

const ACTION_LABEL: Record<Action, string> = {
  CREATED: "Baru",
  UPDATED: "Berubah",
  UNCHANGED: "Tetap",
  FAILED: "Gagal",
  CONFLICT: "Konflik sumber",
};

const PREVIEW_ACTION_LABEL: Record<Action, string> = {
  CREATED: "Rencana baru",
  UPDATED: "Rencana ubah",
  UNCHANGED: "Tetap",
  FAILED: "Gagal",
  CONFLICT: "Konflik sumber",
};

const ACTION_VARIANT: Record<Action, "default" | "secondary" | "destructive" | "outline"> = {
  CREATED: "default",
  UPDATED: "outline",
  UNCHANGED: "secondary",
  FAILED: "destructive",
  CONFLICT: "destructive",
};

const EMPTY_PREVIEW_COUNTS: PreviewCounts = {
  total: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  failed: 0,
  conflict: 0,
  columns: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCounts(value: unknown): value is Counts {
  return (
    isRecord(value) &&
    ["total", "created", "updated", "unchanged", "failed", "conflict"].every(
      (key) => typeof value[key] === "number"
    )
  );
}

/** Validates the server DTO so missing fields fail loudly instead of rendering blanks. */
function readBatch(data: unknown): Batch {
  if (!isRecord(data)) throw new Error("Respons batch tidak valid.");
  if (
    typeof data.id !== "string" ||
    typeof data.status !== "string" ||
    typeof data.fileName !== "string" ||
    !Array.isArray(data.rows) ||
    !Array.isArray(data.outcomes) ||
    !isCounts(data.previewCounts) ||
    !Array.isArray((data.previewCounts as unknown as { columns?: unknown }).columns) ||
    typeof data.canConfirm !== "boolean" ||
    (data.resultCounts !== null && !isCounts(data.resultCounts))
  ) {
    throw new Error("Respons batch tidak lengkap.");
  }
  return data as unknown as Batch;
}

function errorMessage(data: unknown, fallback: string) {
  if (isRecord(data) && typeof data.error === "string") return data.error;
  return fallback;
}

function validCount(counts: Counts) {
  return counts.created + counts.updated + counts.unchanged;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID");
}

function formatChange(change: { from: unknown; to: unknown }) {
  const text = (value: unknown) => (value === null || value === "" ? "kosong" : String(value));
  return `${text(change.from)} → ${text(change.to)}`;
}

export default function AcademicImportPage() {
  const [source, setSource] = useState<Source>("SIAT");
  const [type, setType] = useState<ImportType>("STUDY_PROGRAMS");
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoverNote, setRecoverNote] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const confirmLock = useRef(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/academic-import");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setHistory(data);
    } catch {
      // History is non-critical; keep the last successful list.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function loadBatch(id: string) {
    try {
      const res = await fetch(`/api/admin/academic-import/${id}`);
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(errorMessage(data, "Gagal memuat batch."));
      setBatch(readBatch(data));
      setRecoverNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat batch.");
    }
  }

  async function handlePreview() {
    if (!file) {
      setError("Pilih berkas CSV atau XLSX terlebih dahulu.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Berkas melebihi batas 10 MB.");
      return;
    }
    setPreviewing(true);
    setError(null);
    setRecoverNote(null);
    try {
      const form = new FormData();
      form.set("source", source);
      form.set("type", type);
      form.set("file", file);
      const res = await fetch("/api/admin/academic-import/preview", {
        method: "POST",
        body: form,
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(errorMessage(data, "Pratinjau gagal."));
      setBatch(readBatch(data));
      toast.success("Pratinjau siap. Belum ada data yang disimpan.");
    } catch (err) {
      setBatch(null);
      setError(err instanceof Error ? err.message : "Pratinjau gagal.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!batch || !batch.id) return;
    if (confirmLock.current) return;
    confirmLock.current = true;
    setConfirming(true);
    setError(null);
    setRecoverNote(null);
    try {
      let res: Response;
      try {
        res = await fetch(`/api/admin/academic-import/${batch.id}/confirm`, {
          method: "POST",
        });
      } catch {
        // The server may have committed rows before the response was lost.
        await loadBatch(batch.id);
        await fetchHistory();
        setRecoverNote(
          "Koneksi terputus saat konfirmasi. Status batch dimuat ulang; jangan mengulang impor tanpa memeriksa hasil di bawah."
        );
        return;
      }

      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const batchId = isRecord(data) && typeof data.batchId === "string" ? data.batchId : null;
        if (batchId) await loadBatch(batchId);
        setError(errorMessage(data, "Konfirmasi tidak selesai."));
        toast.warning(errorMessage(data, "Konfirmasi tidak selesai."));
        return;
      }

      await loadBatch(readBatch(data).id);
      await fetchHistory();
      toast.success("Konfirmasi selesai.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konfirmasi gagal.");
    } finally {
      confirmLock.current = false;
      setConfirming(false);
    }
  }

  const previewCounts = batch?.previewCounts ?? EMPTY_PREVIEW_COUNTS;
  const resultCounts = batch?.resultCounts ?? null;
  const shownCounts = resultCounts ?? previewCounts;
  const actionable = validCount(previewCounts);
  const canConfirm = !!batch && batch.canConfirm && !confirming;
  const exportableFailures = shownCounts.failed + shownCounts.conflict;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Impor Data Akademik</h1>
        <p className="text-muted-foreground">
          Impor referensi program studi, mata kuliah, dan dosen dari CSV/XLSX.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Referensi saja — bukan pembuatan akun atau katalog.</p>
        <p className="text-muted-foreground">
          Impor dosen tidak membuat akun/login atau mengubah profil pengguna. Impor mata
          kuliah tidak membuat, menerbitkan, atau mengarsipkan katalog Course. Impor
          program studi wajib dilakukan sebelum impor mata kuliah. Sumber SIAT diutamakan
          atas PIPP. Integrasi API SIAT/PIPP belum tersedia pada versi ini.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Sumber</Label>
            <Select value={source} onValueChange={(value) => setSource(value as Source)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIAT">SIAT</SelectItem>
                <SelectItem value="PIPP">PIPP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Jenis impor</Label>
            <Select value={type} onValueChange={(value) => setType(value as ImportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import-file">Berkas (CSV/XLSX, maks 10 MB)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handlePreview} disabled={previewing || !file}>
              {previewing ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              Pratinjau
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Unduh template:</span>
          <a
            className="underline underline-offset-4"
            href={`/api/admin/academic-import/templates?type=${type}&format=csv`}
          >
            CSV
          </a>
          <a
            className="underline underline-offset-4"
            href={`/api/admin/academic-import/templates?type=${type}&format=xlsx`}
          >
            XLSX
          </a>
          <span className="text-muted-foreground">
            Template aplikasi dengan contoh sintetis, bukan ekspor resmi SIAT/PIPP.
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {recoverNote && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {recoverNote}
        </div>
      )}

      {batch && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Pratinjau / Hasil</h2>
              <p className="text-sm text-muted-foreground">
                {batch.fileName} · {batch.source} · {TYPE_LABEL[batch.type]} · status{" "}
                <span className="font-medium">{batch.status}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Batch {batch.id} · pratinjau kedaluwarsa {formatDate(batch.expiresAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canConfirm && (
                <Button onClick={handleConfirm} disabled={confirming}>
                  {confirming ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <CheckCircle2 data-icon="inline-start" />
                  )}
                  Konfirmasi {actionable} baris valid (rencana)
                </Button>
              )}
              {batch.status === "CONFIRMING" && (
                <Button variant="outline" onClick={() => loadBatch(batch.id)}>
                  <RefreshCw data-icon="inline-start" />
                  Muat status
                </Button>
              )}
              {exportableFailures > 0 && (
                <Button variant="outline" asChild>
                  <a href={`/api/admin/academic-import/${batch.id}/failed`}>
                    <Download data-icon="inline-start" />
                    Unduh baris gagal
                  </a>
                </Button>
              )}
            </div>
          </div>

          {resultCounts && (
            <div>
              <p className="mb-2 text-sm font-medium">Hasil konfirmasi tersimpan</p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
                {[
                  ["Total", resultCounts.total],
                  ["Baru", resultCounts.created],
                  ["Berubah", resultCounts.updated],
                  ["Tetap", resultCounts.unchanged],
                  ["Gagal", resultCounts.failed],
                  ["Konflik", resultCounts.conflict],
                ].map(([label, value]) => (
                  <div key={`result-${label}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Angka ini berasal dari outcome tersimpan. Baris stale atau gagal tidak dihitung
                sebagai berhasil, walaupun rencana pratinjau menyebutkan sebaliknya.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              {resultCounts ? "Rencana pratinjau (bukan hasil)" : "Rencana pratinjau"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
              {[
                ["Total", previewCounts.total],
                ["Rencana baru", previewCounts.created],
                ["Rencana ubah", previewCounts.updated],
                ["Tetap", previewCounts.unchanged],
                ["Gagal", previewCounts.failed],
                ["Konflik", previewCounts.conflict],
              ].map(([label, value]) => (
                <div key={`preview-${label}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {actionable === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="size-4" />
              Tidak ada baris valid untuk disimpan. Perbaiki berkas lalu buat pratinjau baru.
              {previewCounts.failed + previewCounts.conflict > 0
                ? " Baris gagal tetap dapat diunduh untuk diperbaiki."
                : ""}
            </div>
          )}
          {previewCounts.conflict > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              Beberapa baris dimiliki SIAT dan tidak boleh ditimpa PIPP; baris tersebut dilewati.
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Rencana per baris (pratinjau)</p>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Baris</TableHead>
                    <TableHead>Rencana</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        Tidak ada baris data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batch.rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[row.action]}>
                            {PREVIEW_ACTION_LABEL[row.action]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[420px] text-xs">
                          <div>
                            {Object.entries(row.values)
                              .map(([key, value]) => `${key}: ${value ?? ""}`)
                              .join(" · ")}
                          </div>
                          {row.changes &&
                            Object.entries(row.changes).map(([key, change]) => (
                              <div key={key} className="text-muted-foreground">
                                {key}: {formatChange(change)}
                              </div>
                            ))}
                        </TableCell>
                        <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                          {row.errors.join(" ") || row.note || ""}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {batch.outcomes.length > 0 && (
            <div className="text-sm">
              <p className="mb-2 font-medium">Hasil tersimpan per baris (otoritatif)</p>
              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Baris</TableHead>
                      <TableHead>Hasil</TableHead>
                      <TableHead>Pesan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.outcomes.map((outcome) => (
                      <TableRow key={`${outcome.rowNumber}-${outcome.action}`}>
                        <TableCell className="font-mono text-xs">{outcome.rowNumber}</TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[outcome.action]}>
                            {ACTION_LABEL[outcome.action]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {outcome.message ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Riwayat Impor</h2>
            <p className="text-sm text-muted-foreground">
              Gunakan riwayat untuk memulihkan batch setelah gangguan jaringan.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
            {historyLoading ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Muat ulang
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Berkas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Baru/Ubah/Gagal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 7 }).map((__, column) => (
                      <TableCell key={column}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                    Belum ada riwayat impor.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell className="text-xs">{TYPE_LABEL[item.type]}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs" title={item.fileName}>
                      {item.fileName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "CONFIRMED" ? "default" : "secondary"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.status === "CONFIRMED" || item.status === "PARTIAL"
                        ? `${item.createdCount}/${item.updatedCount}/${item.failedCount + item.conflictCount}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadBatch(item.id)}>
                        <FileSpreadsheet data-icon="inline-start" />
                        Lihat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
