"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reviewResponse } from "./feedback-review-shared";
import { FeedbackMarkdown } from "./feedback-markdown";
import { CorrectionVersionCard } from "./correction-version-card";
import type { CorrectionEditorData, CorrectionVersion } from "./correction-types";

type SourceFilters = { search: string; materialId: string; startPage: string; endPage: string };
type AppliedSourceFilters = { search: string; materialId: string; startPage?: number; endPage?: number };

export function FeedbackCorrectionPanel({ feedbackId }: { feedbackId: string }) {
  const [data, setData] = useState<CorrectionEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sourceFilters, setSourceFilters] = useState<AppliedSourceFilters>({ search: "", materialId: "" });
  const [sourceFilterDraft, setSourceFilterDraft] = useState<SourceFilters>({ search: "", materialId: "", startPage: "", endPage: "" });
  const [refresh, setRefresh] = useState(0);
  const [copyRevision, setCopyRevision] = useState(0);
  const [copy, setCopy] = useState<CorrectionVersion | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const endpoint = `/api/dosen/feedback/${feedbackId}/corrections`;
  useEffect(() => {
    const controller = new AbortController();
    setSourcesLoading(true);
    const params = new URLSearchParams({ search: sourceFilters.search, page: String(page) });
    if (sourceFilters.materialId) params.set("materialId", sourceFilters.materialId);
    if (sourceFilters.startPage !== undefined) params.set("startPage", String(sourceFilters.startPage));
    if (sourceFilters.endPage !== undefined) params.set("endPage", String(sourceFilters.endPage));
    fetch(`${endpoint}?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(reviewResponse<CorrectionEditorData>).then((result) => { if (!controller.signal.aborted) { setData(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Koreksi belum dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setSourcesLoading(false); });
    return () => controller.abort();
  }, [endpoint, sourceFilters, page, refresh]);
  function reload() { setRefresh((n) => n + 1); }
  return <section id="feedback-correction" className="flex scroll-mt-6 flex-col gap-5" aria-label="Koreksi jawaban dosen">
    <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold">Koreksi jawaban</h2><p className="text-sm text-muted-foreground">Simpan versi baru, periksa sumbernya, lalu setujui secara terpisah. Koreksi hanya berlaku pada mata kuliah ini.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="ghost" onClick={reload}>Muat ulang koreksi</Button></p>}
    {!data && !error && <Skeleton className="h-64 rounded-xl" />}
    {data && <>
      <Card><CardHeader><CardTitle>Versi koreksi baru</CardTitle><CardDescription>Konten versi lama tetap tersimpan. Sumber materi bersifat opsional; pilih satu atau lebih potongan atau rentang halaman dari materi yang siap.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">
        <CorrectionDraftForm key={`${copy?.id ?? "new"}-${copyRevision}`} data={data} copy={copy} endpoint={endpoint} onSaved={reload}
          sourceFilterDraft={sourceFilterDraft} onSourceFilterDraftChange={(value) => setSourceFilterDraft((previous) => ({ ...previous, ...value }))}
          onSearch={(filters) => { setPage(1); setSourceFilters(filters); }} onPageChange={setPage} sourcesLoading={sourcesLoading} />
      </CardContent></Card>
      <h3 className="font-medium">Riwayat versi terkait</h3>
      {data.versions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada koreksi untuk feedback ini.</p>}
      {data.versions.map((version) => <CorrectionVersionCard key={version.id} version={version} onChanged={reload} onCopy={(version) => { setCopy(version); setCopyRevision((n) => n + 1); }} />)}
    </>}
  </section>;
}

type SelectedSource = { id: string; title: string; pageNumber: number; chunkIndex: number; snippet: string };
type SelectedPageRange = { materialId: string; startPage: number; endPage: number; title: string };

function CorrectionDraftForm({ data, copy, endpoint, onSaved, sourceFilterDraft, onSourceFilterDraftChange, onSearch, onPageChange, sourcesLoading }: {
  data: CorrectionEditorData; copy: CorrectionVersion | null; endpoint: string; onSaved: () => void;
  sourceFilterDraft: SourceFilters; onSourceFilterDraftChange: (value: Partial<SourceFilters>) => void;
  onSearch: (filters: AppliedSourceFilters) => void;
  onPageChange: (page: number) => void; sourcesLoading: boolean;
}) {
  const id = useId();
  const [question, setQuestion] = useState(copy?.question ?? data.question);
  const [answer, setAnswer] = useState(copy?.answer ?? "");
  const [rationale, setRationale] = useState(copy?.rationale ?? "");
  const [sources, setSources] = useState<SelectedSource[]>(() => (copy?.sourceSnapshot ?? []).flatMap((source) => {
    if ("kind" in source && source.kind === "page_range") return [];
    return [{ id: source.chunkId, title: source.materialTitle, pageNumber: source.pageNumber, chunkIndex: source.chunkIndex,
      snippet: "content" in source ? source.content.slice(0, 300) : "" }];
  }));
  const [sourceRanges, setSourceRanges] = useState<SelectedPageRange[]>(() => (copy?.sourceSnapshot ?? []).flatMap((source) =>
    "kind" in source && source.kind === "page_range" ? [{ materialId: source.materialId, startPage: source.startPage, endPage: source.endPage, title: source.materialTitle }] : []));
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState("suggested");
  const [rangeError, setRangeError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [confirmWithoutSources, setConfirmWithoutSources] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  async function persistDraft() {
    if (pending) return; setPending(true); setError(null); setSaved("");
    try {
      const version = await reviewResponse<{ version: number }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        question, answer, rationale, sourceChunkIds: sources.map((source) => source.id),
        sourceRanges: sourceRanges.map(({ materialId, startPage, endPage }) => ({ materialId, startPage, endPage })),
      }) }));
      setSaved(`Draft versi ${version.version} tersimpan. Tinjau dan setujui untuk mengaktifkannya.`); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Draft gagal disimpan."); } finally { setPending(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!sources.length && !sourceRanges.length) { setConfirmWithoutSources(true); return; }
    void persistDraft();
  }
  function toggleSource(source: SelectedSource, checked: boolean) {
    setSources((previous) => checked
      ? previous.some((item) => item.id === source.id) ? previous : [...previous, source]
      : previous.filter((item) => item.id !== source.id));
  }
  function addPageRange() {
    setRangeError("");
    const { materialId, startPage, endPage } = sourceFilterDraft;
    const material = data.materials.find((item) => item.id === materialId);
    const first = Number(startPage);
    const last = Number(endPage);
    if (!material || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > material.pageCount) {
      setRangeError("Pilih materi dan rentang halaman yang valid.");
      return;
    }
    setSourceRanges((previous) => {
      const sameMaterial = previous.filter((range) => range.materialId === materialId);
      const otherMaterials = previous.filter((range) => range.materialId !== materialId);
      const ranges = [...sameMaterial, { materialId, startPage: first, endPage: last, title: material.title }]
        .sort((a, b) => a.startPage - b.startPage);
      const merged: SelectedPageRange[] = [];
      for (const range of ranges) {
        const prior = merged.at(-1);
        if (prior && range.startPage <= prior.endPage + 1) prior.endPage = Math.max(prior.endPage, range.endPage);
        else merged.push({ ...range });
      }
      return [...otherMaterials, ...merged];
    });
  }
  function applyManualFilters() {
    setFilterError("");
    const { search, materialId, startPage, endPage } = sourceFilterDraft;
    if ((startPage.length > 0) !== (endPage.length > 0) || ((startPage || endPage) && !materialId)) {
      setFilterError("Pilih materi dan isi kedua batas halaman untuk memakai filter rentang.");
      return;
    }
    const first = startPage ? Number(startPage) : undefined;
    const last = endPage ? Number(endPage) : undefined;
    if (first !== undefined && last !== undefined && (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first)) {
      setFilterError("Rentang halaman tidak valid.");
      return;
    }
    onSearch({ search: search.trim(), materialId, startPage: first, endPage: last });
  }
  const selectedCount = sources.length + sourceRanges.length;
  return <form onSubmit={save} className="flex flex-col gap-5">
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${id}-question`}>Pertanyaan acuan</FieldLabel><Textarea id={`${id}-question`} value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <Field><FieldLabel htmlFor={`${id}-answer`}>Jawaban koreksi</FieldLabel><Textarea id={`${id}-answer`} value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={10} maxLength={2000} required disabled={pending} /><FieldDescription>{answer.length}/2000 karakter. Markdown didukung.</FieldDescription>{answer.trim() && <details className="rounded-lg border px-3 py-2"><summary className="w-fit cursor-pointer text-sm font-medium">Pratinjau format jawaban</summary><FeedbackMarkdown content={answer} className="mt-3" /></details>}</Field>
      <Field><FieldLabel htmlFor={`${id}-rationale`}>Alasan perbaikan</FieldLabel><Textarea id={`${id}-rationale`} value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <FieldSet><FieldLegend variant="label">Sumber pendukung · {selectedCount} dipilih</FieldLegend>
        <FieldDescription>{copy && !copy.sourceCurrent ? "Sumber versi yang disalin sudah berubah. Hapus sumber lama dan pilih potongan terkini. " : ""}Pilih rekomendasi dari pencarian saat jawaban dibuat, cari potongan sendiri, atau lampirkan rentang halaman.</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setSourcePickerOpen(true)}><Search data-icon="inline-start" />Pilih sumber</Button>
          <Badge variant={selectedCount > 0 ? "secondary" : "outline"}>{selectedCount} pilihan</Badge>
          {selectedCount > 0 && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setSources([]); setSourceRanges([]); }}>Kosongkan</Button>}
        </div>
        {selectedCount > 0 && <ul className="flex flex-col gap-2" aria-label="Sumber terpilih">
          {sources.map((source) => <li key={source.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{source.title} · Halaman {source.pageNumber} · Potongan {source.chunkIndex + 1}</p><p className="line-clamp-2 text-sm text-muted-foreground">{source.snippet}</p></div>
            <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={() => toggleSource(source, false)} aria-label={`Hapus sumber ${source.title}, halaman ${source.pageNumber}`}><X data-icon="inline-start" /></Button>
          </li>)}
          {sourceRanges.map((range) => <li key={`${range.materialId}-${range.startPage}-${range.endPage}`} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
            <p className="min-w-0 flex-1 text-sm font-medium">{range.title} · Halaman {range.startPage}–{range.endPage}</p>
            <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={() => setSourceRanges((previous) => previous.filter((item) => item !== range))} aria-label={`Hapus rentang ${range.title}, halaman ${range.startPage} sampai ${range.endPage}`}><X data-icon="inline-start" /></Button>
          </li>)}
        </ul>}
        <Dialog open={sourcePickerOpen} onOpenChange={setSourcePickerOpen}>
          <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Cari sumber pendukung</DialogTitle>
              <DialogDescription>Rekomendasi memakai pencarian vector dari jawaban asli. Pilihan manual dapat berupa potongan tertentu atau rentang halaman.</DialogDescription>
            </DialogHeader>
            <Tabs value={sourceMode} onValueChange={setSourceMode} className="min-h-0 flex-1 overflow-hidden px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="suggested">Rekomendasi</TabsTrigger><TabsTrigger value="manual">Pilih manual</TabsTrigger></TabsList>
              <TabsContent value="suggested" className="min-h-0 flex-1 overflow-y-auto py-4">
                {sourcesLoading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Memuat kandidat…</p> : data.suggestedSources.length === 0
                  ? <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada bukti vector tersimpan untuk jawaban ini. Gunakan pilihan manual.</p>
                  : <div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">{data.suggestedSources.length} potongan teratas dari retrieval jawaban asli.</p>{data.suggestedSources.map((source) => <SourceOption key={source.id} id={`${id}-suggested-${source.id}`} source={source} checked={sources.some((item) => item.id === source.id)} disabled={pending} onCheckedChange={(checked) => toggleSource(source, checked)} />)}</div>}
              </TabsContent>
              <TabsContent value="manual" className="min-h-0 flex-1 overflow-y-auto py-4">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
                    <Input aria-label="Cari materi" value={sourceFilterDraft.search} maxLength={100} placeholder="Cari istilah atau judul materi" onChange={(event) => onSourceFilterDraftChange({ search: event.target.value })} />
                    <Select value={sourceFilterDraft.materialId || "all"} onValueChange={(value) => onSourceFilterDraftChange({ materialId: value === "all" ? "" : value })}>
                      <SelectTrigger aria-label="Pilih materi"><SelectValue placeholder="Semua materi" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Semua materi</SelectItem>{data.materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-medium">Lampirkan rentang halaman</p>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
                      <div className="text-sm text-muted-foreground">Pilih materi dan halaman yang ingin dipakai sebagai batas pencarian bukti.</div>
                      <Input aria-label="Halaman awal" type="number" min={1} max={data.materials.find((m) => m.id === sourceFilterDraft.materialId)?.pageCount ?? undefined} placeholder="Dari" value={sourceFilterDraft.startPage} onChange={(event) => onSourceFilterDraftChange({ startPage: event.target.value })} />
                      <Input aria-label="Halaman akhir" type="number" min={1} max={data.materials.find((m) => m.id === sourceFilterDraft.materialId)?.pageCount ?? undefined} placeholder="Sampai" value={sourceFilterDraft.endPage} onChange={(event) => onSourceFilterDraftChange({ endPage: event.target.value })} />
                      <Button type="button" variant="outline" disabled={pending} onClick={addPageRange}>Tambah rentang</Button>
                    </div>
                    {rangeError && <p role="alert" className="mt-2 text-sm text-destructive">{rangeError}</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Filter halaman opsional; tombol Cari menerapkan filter dan kata kunci.</p><Button type="button" variant="outline" disabled={sourcesLoading} onClick={applyManualFilters}><Search data-icon="inline-start" />Cari</Button></div>
                  {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
                  <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{data.totalSources.toLocaleString("id-ID")} hasil</span><Badge variant="secondary">{selectedCount} dipilih</Badge></div>
                  {sourcesLoading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Mencari potongan…</p> : data.sources.length === 0
                    ? <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil. Coba kata kunci atau rentang lain.</p>
                    : <div className="flex flex-col gap-2">{data.sources.map((source) => <SourceOption key={source.id} id={`${id}-manual-${source.id}`} source={source} checked={sources.some((item) => item.id === source.id)} disabled={pending} onCheckedChange={(checked) => toggleSource(source, checked)} />)}</div>}
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="flex-row items-center justify-between border-t px-6 py-4 sm:justify-between">
              <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={sourceMode !== "manual" || sourcesLoading || data.sourcePage <= 1} onClick={() => onPageChange(data.sourcePage - 1)}>Sebelumnya</Button><span className="min-w-24 text-center text-xs text-muted-foreground">Halaman {data.sourcePage} dari {Math.max(1, Math.ceil(data.totalSources / data.sourcePageSize))}</span><Button type="button" variant="outline" size="sm" disabled={sourceMode !== "manual" || sourcesLoading || data.sourcePage * data.sourcePageSize >= data.totalSources} onClick={() => onPageChange(data.sourcePage + 1)}>Berikutnya</Button></div>
              <Button type="button" onClick={() => setSourcePickerOpen(false)}>Selesai · {selectedCount} sumber</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FieldSet>
    </FieldGroup>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{saved && <p role="status" className="text-sm">{saved}</p>}
    <Button type="submit" disabled={pending} className="self-start">{pending ? "Menyimpan…" : "Simpan sebagai versi baru"}</Button>
    <AlertDialog open={confirmWithoutSources} onOpenChange={setConfirmWithoutSources}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Simpan koreksi tanpa sumber?</AlertDialogTitle><AlertDialogDescription>Koreksi ini tidak akan mencantumkan potongan materi pendukung. Tutor tetap hanya akan menggunakannya ketika pencarian materi lain menemukan bukti yang relevan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); setConfirmWithoutSources(false); void persistDraft(); }}>Lanjut tanpa sumber</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </form>;
}

function SourceOption({ id, source, checked, disabled, onCheckedChange }: {
  id: string; source: { id: string; title: string; pageNumber: number; chunkIndex: number; snippet: string; content: string };
  checked: boolean; disabled: boolean; onCheckedChange: (checked: boolean) => void;
}) {
  return <Field orientation="horizontal" className="items-start rounded-lg border px-3 py-3">
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
    <div className="min-w-0 flex-1"><FieldLabel htmlFor={id} className="flex flex-col gap-1"><span>{source.title} · Halaman {source.pageNumber} · Potongan {source.chunkIndex + 1}</span><span className="line-clamp-3 font-normal text-muted-foreground">{source.snippet}</span></FieldLabel>
      <details className="mt-2 text-sm"><summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Lihat seluruh potongan</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-muted-foreground">{source.content}</p></details>
    </div>
  </Field>;
}
