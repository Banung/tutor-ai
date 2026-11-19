"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CircleAlert, FileText, LoaderCircle, Play, Plus, Save,
  Sparkles, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type AlignmentMaterial = {
  id: string;
  title: string;
  fileName: string;
  sessionTitle: string;
  pageCount: number | null;
};

type SourceSnapshot = {
  materialId?: string;
  materialTitle?: string;
  fileName?: string;
  startPage?: number;
  endPage?: number;
  pageNumber?: number;
};

type AlignmentCase = {
  id: string;
  origin: string;
  question: string;
  referenceAnswer: string;
  rubric: string | null;
  sourceSnapshot: unknown;
  isApproved: boolean;
  selected: boolean;
  tutorAnswer: string | null;
  verdict: string | null;
  grounded: boolean | null;
  scoreReason: string | null;
  correctionDraftId: string | null;
};

type AlignmentSession = {
  id: string;
  status: string;
  trigger: string;
  thresholdPercent: number;
  accuracyPercent: number | null;
  correctCount: number;
  caseCount: number;
  errorMessage: string | null;
  createdAt: string;
  materialSnapshot: unknown;
  cases: AlignmentCase[];
};

type AlignmentOverview = {
  course: { id: string; title: string; alignmentAutoRerun: boolean };
  materials: AlignmentMaterial[];
  sessions: AlignmentSession[];
};

type CaseEdit = Partial<Pick<AlignmentCase, "question" | "referenceAnswer" | "rubric">>;

function getSources(value: unknown): SourceSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SourceSnapshot => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function getMaterialIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item)
    && typeof (item as Record<string, unknown>).id === "string" ? [(item as Record<string, string>).id] : []);
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draf", queued: "Menunggu", running: "Berjalan", completed: "Selesai", failed: "Gagal", stale: "Materi berubah",
  };
  return labels[status] ?? status;
}

function sourceLabel(source: SourceSnapshot) {
  const pages = source.startPage && source.endPage
    ? source.startPage === source.endPage ? `hlm. ${source.startPage}` : `hlm. ${source.startPage}–${source.endPage}`
    : source.pageNumber ? `hlm. ${source.pageNumber}` : "";
  return [source.materialTitle ?? source.fileName ?? "Materi", pages].filter(Boolean).join(" · ");
}

async function requestJson<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Permintaan gagal diproses.");
  return result as T;
}

export default function CourseAlignmentPage({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<AlignmentOverview | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [thresholdPercent, setThresholdPercent] = useState(90);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [caseEdits, setCaseEdits] = useState<Record<string, CaseEdit>>({});
  const [manualCase, setManualCase] = useState({
    question: "", referenceAnswer: "", rubric: "", materialId: "", startPage: "", endPage: "",
  });
  const materialSelectionInitialized = useRef(false);

  const reload = useCallback(async (preferSessionId?: string) => {
    try {
      const data = await requestJson<AlignmentOverview>(`/api/dosen/courses/${courseId}/alignment`);
      setOverview(data);
      if (!materialSelectionInitialized.current) {
        setSelectedMaterialIds(data.materials.map((material) => material.id));
        materialSelectionInitialized.current = true;
      } else {
        setSelectedMaterialIds((current) => current.filter((id) => data.materials.some((material) => material.id === id)));
      }
      setSelectedSessionId((current) => {
        const next = preferSessionId ?? (current && data.sessions.some((item) => item.id === current) ? current : data.sessions[0]?.id ?? null);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat penyelarasan.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void reload(); }, [reload]);

  const activeSession = useMemo(
    () => overview?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [overview, selectedSessionId],
  );
  const sessionMaterialIds = useMemo(() => new Set(getMaterialIds(activeSession?.materialSnapshot)), [activeSession]);
  const sessionMaterials = overview?.materials.filter((material) => sessionMaterialIds.has(material.id)) ?? [];

  useEffect(() => {
    if (activeSession) setThresholdPercent(activeSession.thresholdPercent);
  }, [activeSession?.id, activeSession?.thresholdPercent]);

  useEffect(() => {
    if (!activeSession || !["queued", "running"].includes(activeSession.status)) return;
    const intervalId = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(intervalId);
  }, [activeSession, reload]);

  const canRunCount = activeSession?.cases.filter((item) => item.selected && item.isApproved).length ?? 0;
  const reportCases = activeSession?.cases.filter((item) => item.selected && item.isApproved) ?? [];
  const failedCases = reportCases.filter((item) => item.verdict !== "correct" || item.grounded !== true);
  const hasUnsavedChanges = activeSession?.cases.some((item) => {
    const edit = caseEdits[item.id];
    return Boolean(edit && (
      (edit.question !== undefined && edit.question !== item.question)
      || (edit.referenceAnswer !== undefined && edit.referenceAnswer !== item.referenceAnswer)
      || (edit.rubric !== undefined && edit.rubric !== (item.rubric ?? ""))
    ));
  }) ?? false;

  async function createSession(mode: "ai" | "manual") {
    if (!selectedMaterialIds.length) {
      toast.error("Pilih minimal satu materi.");
      return;
    }
    setBusy(true);
    try {
      const created = await requestJson<AlignmentSession>(`/api/dosen/courses/${courseId}/alignment`, "POST", {
        mode, materialIds: selectedMaterialIds, thresholdPercent,
      });
      await reload(created.id);
      toast.success(mode === "ai" ? "Draf AI siap ditinjau." : "Sesi manual dibuat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat sesi.");
    } finally {
      setBusy(false);
    }
  }

  async function changeAutoRerun(enabled: boolean) {
    if (!overview) return;
    setOverview({ ...overview, course: { ...overview.course, alignmentAutoRerun: enabled } });
    try {
      await requestJson(`/api/dosen/courses/${courseId}/alignment`, "PATCH", { autoRerun: enabled });
    } catch (error) {
      setOverview({ ...overview, course: { ...overview.course, alignmentAutoRerun: !enabled } });
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pengaturan.");
    }
  }

  async function updateCase(caseId: string, body: Record<string, unknown>) {
    if (!activeSession) return;
    try {
      await requestJson(`/api/dosen/courses/${courseId}/alignment/${activeSession.id}/cases/${caseId}`, "PATCH", body);
      setCaseEdits((current) => { const next = { ...current }; delete next[caseId]; return next; });
      await reload(activeSession.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui kasus.");
    }
  }

  async function addManualCase() {
    if (!activeSession) return;
    setBusy(true);
    try {
      const sourceRanges = manualCase.materialId && Number(manualCase.startPage) > 0
        ? [{ materialId: manualCase.materialId, startPage: Number(manualCase.startPage), endPage: Number(manualCase.endPage || manualCase.startPage) }]
        : [];
      await requestJson(`/api/dosen/courses/${courseId}/alignment/${activeSession.id}/cases`, "POST", {
        question: manualCase.question,
        referenceAnswer: manualCase.referenceAnswer,
        rubric: manualCase.rubric || null,
        sourceRanges,
      });
      setManualCase({ question: "", referenceAnswer: "", rubric: "", materialId: "", startPage: "", endPage: "" });
      await reload(activeSession.id);
      toast.success("Kasus ditambahkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan kasus.");
    } finally {
      setBusy(false);
    }
  }

  async function runAlignment() {
    if (!activeSession) return;
    setBusy(true);
    try {
      await requestJson(`/api/dosen/courses/${courseId}/alignment/${activeSession.id}/run`, "POST", {});
      await reload(activeSession.id);
      toast.success("Penyelarasan dimulai.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menjalankan penyelarasan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsCorrection(item: AlignmentCase) {
    if (!activeSession) return;
    setBusy(true);
    try {
      await requestJson(`/api/dosen/courses/${courseId}/alignment/${activeSession.id}/cases/${item.id}/correction`, "POST", {
        answer: item.referenceAnswer,
        rationale: "Perbaikan berdasarkan hasil penyelarasan.",
      });
      await reload(activeSession.id);
      toast.success("Draf koreksi tersimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan draf koreksi.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCase(caseId: string) {
    if (!activeSession) return;
    setBusy(true);
    try {
      await requestJson(`/api/dosen/courses/${courseId}/alignment/${activeSession.id}/cases/${caseId}`, "DELETE");
      await reload(activeSession.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus kasus.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex flex-col gap-5"><Skeleton className="h-8 w-64" /><Skeleton className="h-52 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!overview) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Course tidak ditemukan.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/dosen/courses/${courseId}`)} className="-ml-2 self-start text-muted-foreground">
        <ArrowLeft data-icon="inline-start" /> Kembali ke mata kuliah
      </Button>

      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{overview.course.title}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Penyelarasan Tutor</h1>
        <p className="text-sm text-muted-foreground">Opsional · cek jawaban Tutor terhadap materi; Tutor tetap dapat digunakan tanpa sesi ini.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buat sesi</CardTitle>
          <CardDescription>Pilih materi, lalu buat draf AI atau tulis kasus sendiri.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {overview.materials.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {overview.materials.map((material) => (
                <label key={material.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40">
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedMaterialIds.includes(material.id)}
                    onCheckedChange={(checked) => setSelectedMaterialIds((current) => checked === true
                      ? [...current, material.id]
                      : current.filter((id) => id !== material.id))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{material.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{material.sessionTitle} · {material.pageCount ?? 0} halaman</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada PDF materi yang siap.</p>
          )}

          <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-32 space-y-1.5">
                <Label htmlFor="alignment-threshold" className="text-xs">Ambang akurasi</Label>
                <div className="relative">
                  <Input id="alignment-threshold" type="number" min={1} max={100} value={thresholdPercent} onChange={(event) => setThresholdPercent(Number(event.target.value))} className="pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={overview.course.alignmentAutoRerun} onCheckedChange={(checked) => void changeAutoRerun(checked === true)} />
                Ulangi saat materi berubah
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void createSession("manual")} disabled={busy || !overview.materials.length || !selectedMaterialIds.length}>
                <Plus data-icon="inline-start" /> Tulis kasus sendiri
              </Button>
              <Button onClick={() => void createSession("ai")} disabled={busy || !overview.materials.length || !selectedMaterialIds.length}>
                {busy ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                Buat 10 draf AI
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {overview.sessions.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-3"><CardTitle className="text-base">Sesi penyelarasan</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {overview.sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => { setSelectedSessionId(session.id); setThresholdPercent(session.thresholdPercent); setCaseEdits({}); }}
                  className={`rounded-lg border p-3 text-left transition-colors ${session.id === selectedSessionId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{formatSessionDate(session.createdAt)}</span>
                    <Badge variant={session.status === "completed" ? "default" : "secondary"}>{statusLabel(session.status)}</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{session.trigger === "material_change" ? "Otomatis · materi berubah" : `${session.caseCount} kasus`}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {activeSession && (
            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">{statusLabel(activeSession.status)}</CardTitle>
                    <CardDescription>{activeSession.cases.length} kasus · ambang {activeSession.thresholdPercent}%</CardDescription>
                  </div>
                  {activeSession.status === "draft" && (
                      <Button onClick={() => void runAlignment()} disabled={busy || canRunCount === 0 || hasUnsavedChanges}>
                      <Play data-icon="inline-start" /> Jalankan ({canRunCount})
                    </Button>
                  )}
                  {["queued", "running"].includes(activeSession.status) && <LoaderCircle className="size-5 animate-spin text-muted-foreground" />}
                </CardHeader>
                {activeSession.errorMessage && <CardContent className="pt-0 text-sm text-destructive">{activeSession.errorMessage}</CardContent>}
              </Card>

              {activeSession.status === "completed" && (
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">Akurasi jawaban benar dan bersumber</p>
                      <p className="mt-1 text-3xl font-semibold">{Math.round(activeSession.accuracyPercent ?? 0)}%</p>
                      <p className="text-sm text-muted-foreground">{activeSession.correctCount} dari {activeSession.caseCount} kasus</p>
                    </div>
                    <Badge variant={(activeSession.accuracyPercent ?? 0) >= activeSession.thresholdPercent ? "default" : "destructive"}>
                      {(activeSession.accuracyPercent ?? 0) >= activeSession.thresholdPercent ? "Mencapai ambang" : "Di bawah ambang"}
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {activeSession.status === "draft" ? (
                <>
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-medium">Kasus untuk diuji</h2>
                      <span className="text-xs text-muted-foreground">Pilih dan setujui sebelum dijalankan</span>
                    </div>
                    {!activeSession.cases.length && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Belum ada kasus. Tambahkan pertanyaan dosen di bawah.</p>}
                    {activeSession.cases.map((item, index) => {
                      const edit = caseEdits[item.id] ?? {};
                      const question = edit.question ?? item.question;
                      const referenceAnswer = edit.referenceAnswer ?? item.referenceAnswer;
                      const rubric = edit.rubric ?? item.rubric ?? "";
                      const changed = question !== item.question || referenceAnswer !== item.referenceAnswer || rubric !== (item.rubric ?? "");
                      const sources = getSources(item.sourceSnapshot);
                      return (
                        <Card key={item.id}>
                          <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Checkbox checked={item.selected} onCheckedChange={(checked) => void updateCase(item.id, { selected: checked === true })} />
                                <span className="text-sm font-medium">Kasus {index + 1}</span>
                                <Badge variant="outline">{item.origin === "ai" ? "Draf AI" : "Dosen"}</Badge>
                                {item.origin === "ai" && <Badge variant={item.isApproved ? "default" : "secondary"}>{item.isApproved ? "Disetujui" : "Perlu ditinjau"}</Badge>}
                              </div>
                              <div className="flex gap-2">
                                {item.origin === "ai" && (
                                  <Button size="sm" variant="outline" disabled={busy || changed} onClick={() => void updateCase(item.id, { isApproved: !item.isApproved })}>
                                    {item.isApproved ? "Batalkan persetujuan" : "Setujui"}
                                  </Button>
                                )}
                                <Button size="icon-sm" variant="ghost" aria-label="Hapus kasus" onClick={() => void removeCase(item.id)}><Trash2 /></Button>
                              </div>
                            </div>
                            <div className="grid gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor={`question-${item.id}`}>Pertanyaan</Label>
                                <Textarea id={`question-${item.id}`} value={question} onChange={(event) => setCaseEdits((current) => ({ ...current, [item.id]: { ...current[item.id], question: event.target.value } }))} rows={2} />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`answer-${item.id}`}>Jawaban acuan</Label>
                                <Textarea id={`answer-${item.id}`} value={referenceAnswer} onChange={(event) => setCaseEdits((current) => ({ ...current, [item.id]: { ...current[item.id], referenceAnswer: event.target.value } }))} rows={3} />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`rubric-${item.id}`}>Rubrik <span className="font-normal text-muted-foreground">(opsional)</span></Label>
                                <Input id={`rubric-${item.id}`} value={rubric} onChange={(event) => setCaseEdits((current) => ({ ...current, [item.id]: { ...current[item.id], rubric: event.target.value } }))} />
                              </div>
                            </div>
                            {sources.length > 0 && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" />{sources.map(sourceLabel).join(" · ")}</p>}
                            {changed && <div className="flex justify-end"><Button size="sm" variant="outline" disabled={busy} onClick={() => void updateCase(item.id, { question, referenceAnswer, rubric: rubric || null })}><Save data-icon="inline-start" /> Simpan perubahan</Button></div>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </section>

                  {activeSession.cases.length < 10 && (
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-base">Tambah kasus dosen</CardTitle></CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="space-y-1.5"><Label>Pertanyaan</Label><Textarea value={manualCase.question} onChange={(event) => setManualCase({ ...manualCase, question: event.target.value })} rows={2} /></div>
                        <div className="space-y-1.5"><Label>Jawaban acuan</Label><Textarea value={manualCase.referenceAnswer} onChange={(event) => setManualCase({ ...manualCase, referenceAnswer: event.target.value })} rows={3} /></div>
                        <div className="space-y-1.5"><Label>Rubrik <span className="font-normal text-muted-foreground">(opsional)</span></Label><Input value={manualCase.rubric} onChange={(event) => setManualCase({ ...manualCase, rubric: event.target.value })} /></div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px_100px]">
                          <div className="space-y-1.5"><Label>Sumber materi <span className="font-normal text-muted-foreground">(opsional)</span></Label>
                            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={manualCase.materialId} onChange={(event) => setManualCase({ ...manualCase, materialId: event.target.value, startPage: "", endPage: "" })}>
                              <option value="">Pilih materi</option>
                              {sessionMaterials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5"><Label>Halaman awal</Label><Input type="number" min={1} value={manualCase.startPage} onChange={(event) => setManualCase({ ...manualCase, startPage: event.target.value })} /></div>
                          <div className="space-y-1.5"><Label>Halaman akhir</Label><Input type="number" min={1} value={manualCase.endPage} onChange={(event) => setManualCase({ ...manualCase, endPage: event.target.value })} /></div>
                        </div>
                        <div className="flex justify-end"><Button onClick={() => void addManualCase()} disabled={busy || !manualCase.question.trim() || !manualCase.referenceAnswer.trim()}><Plus data-icon="inline-start" /> Tambahkan</Button></div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : activeSession.status === "completed" ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-medium">Perlu diperbaiki ({failedCases.length})</h2>
                  {failedCases.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Semua kasus yang diuji lulus.</p> : failedCases.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <CircleAlert className="size-4 text-amber-600" />
                          <h3 className="font-medium">{item.question}</h3>
                          <Badge variant="destructive">{item.verdict === "partial" ? "Sebagian sesuai" : item.verdict === "needs_review" ? "Perlu ditinjau" : "Kurang sesuai"}</Badge>
                          {item.grounded === false && <Badge variant="outline">Belum bersumber</Badge>}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><p className="mb-1 text-xs font-medium text-muted-foreground">Jawaban Tutor</p><p className="whitespace-pre-wrap text-sm">{item.tutorAnswer || "Tidak ada jawaban."}</p></div>
                          <div><p className="mb-1 text-xs font-medium text-muted-foreground">Jawaban acuan</p><p className="whitespace-pre-wrap text-sm">{item.referenceAnswer}</p></div>
                        </div>
                        {item.scoreReason && <p className="text-xs text-muted-foreground">{item.scoreReason}</p>}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <div className="flex flex-wrap gap-1.5">{getSources(item.sourceSnapshot).map((source, index) => <Badge key={`${item.id}-source-${index}`} variant="outline">{sourceLabel(source)}</Badge>)}</div>
                          {item.correctionDraftId ? (
                            <Button asChild size="sm" variant="outline"><Link href="/dosen/corrections"><Check data-icon="inline-start" /> Tinjau draf koreksi</Link></Button>
                          ) : getSources(item.sourceSnapshot).length > 0 ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveAsCorrection(item)}>Simpan sebagai koreksi</Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              ) : activeSession.status === "stale" ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Materi berubah. Buat sesi baru untuk menjalankan kasus pada versi terbaru.</CardContent></Card>
              ) : activeSession.status === "failed" ? (
                <Card><CardContent className="p-5 text-sm text-muted-foreground">Penyelarasan gagal. Buat sesi baru untuk mencoba lagi.</CardContent></Card>
              ) : null}
            </div>
          )}
        </div>
      )}
      {!overview.sessions.length && <p className="text-sm text-muted-foreground">Belum ada sesi penyelarasan.</p>}
    </div>
  );
}
