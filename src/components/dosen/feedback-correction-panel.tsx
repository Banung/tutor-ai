"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewResponse } from "./feedback-review-shared";
import { FeedbackMarkdown } from "./feedback-markdown";
import { CorrectionVersionCard } from "./correction-version-card";
import type { CorrectionEditorData, CorrectionVersion } from "./correction-types";

export function FeedbackCorrectionPanel({ feedbackId }: { feedbackId: string }) {
  const [data, setData] = useState<CorrectionEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [copyRevision, setCopyRevision] = useState(0);
  const [copy, setCopy] = useState<CorrectionVersion | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const endpoint = `/api/dosen/feedback/${feedbackId}/corrections`;
  useEffect(() => {
    const controller = new AbortController();
    setSourcesLoading(true);
    fetch(`${endpoint}?${new URLSearchParams({ search, page: String(page) })}`, { signal: controller.signal, cache: "no-store" })
      .then(reviewResponse<CorrectionEditorData>).then((result) => { if (!controller.signal.aborted) { setData(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Koreksi belum dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setSourcesLoading(false); });
    return () => controller.abort();
  }, [endpoint, search, page, refresh]);
  function reload() { setRefresh((n) => n + 1); }
  return <section id="feedback-correction" className="flex scroll-mt-6 flex-col gap-5" aria-label="Koreksi jawaban dosen">
    <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold">Koreksi jawaban</h2><p className="text-sm text-muted-foreground">Simpan versi baru, periksa sumbernya, lalu setujui secara terpisah. Koreksi hanya berlaku pada mata kuliah ini.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="ghost" onClick={reload}>Muat ulang koreksi</Button></p>}
    {!data && !error && <Skeleton className="h-64 rounded-xl" />}
    {data && <>
      <Card><CardHeader><CardTitle>Versi koreksi baru</CardTitle><CardDescription>Konten versi lama tetap tersimpan. Pilih maksimal lima potongan dari materi aktif yang sudah siap.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">
        <CorrectionDraftForm key={`${copy?.id ?? "new"}-${copyRevision}`} data={data} copy={copy} endpoint={endpoint} onSaved={reload}
          searchDraft={searchDraft} activeSearch={search} onSearchDraftChange={setSearchDraft} onSearch={(value) => { setPage(1); setSearch(value); }}
          onPageChange={setPage} sourcesLoading={sourcesLoading} />
      </CardContent></Card>
      <h3 className="font-medium">Riwayat versi terkait</h3>
      {data.versions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada koreksi untuk feedback ini.</p>}
      {data.versions.map((version) => <CorrectionVersionCard key={version.id} version={version} onChanged={reload} onCopy={(version) => { setCopy(version); setCopyRevision((n) => n + 1); }} />)}
    </>}
  </section>;
}

type SelectedSource = { id: string; title: string; pageNumber: number; chunkIndex: number; snippet: string };

function CorrectionDraftForm({ data, copy, endpoint, onSaved, searchDraft, activeSearch, onSearchDraftChange, onSearch, onPageChange, sourcesLoading }: {
  data: CorrectionEditorData; copy: CorrectionVersion | null; endpoint: string; onSaved: () => void;
  searchDraft: string; activeSearch: string; onSearchDraftChange: (value: string) => void; onSearch: (value: string) => void;
  onPageChange: (page: number) => void; sourcesLoading: boolean;
}) {
  const id = useId();
  const [question, setQuestion] = useState(copy?.question ?? data.question);
  const [answer, setAnswer] = useState(copy?.answer ?? "");
  const [rationale, setRationale] = useState(copy?.rationale ?? "");
  const [sources, setSources] = useState<string[]>(copy?.sourceSnapshot.map((source) => source.chunkId) ?? []);
  const [selectedSourceDetails, setSelectedSourceDetails] = useState<Record<string, SelectedSource>>(() => Object.fromEntries(
    (copy?.sourceSnapshot ?? []).map((source) => [source.chunkId, {
      id: source.chunkId, title: source.materialTitle, pageNumber: source.pageNumber,
      chunkIndex: source.chunkIndex, snippet: source.content.slice(0, 300),
    }])
  ));
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); if (pending) return; setPending(true); setError(null); setSaved("");
    try {
      const version = await reviewResponse<{ version: number }>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, rationale, sourceChunkIds: sources }) }));
      setSaved(`Draft versi ${version.version} tersimpan. Tinjau dan setujui untuk mengaktifkannya.`); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Draft gagal disimpan."); } finally { setPending(false); }
  }
  function toggleSource(source: SelectedSource, checked: boolean) {
    if (checked) {
      if (sources.length >= 5 && !sources.includes(source.id)) return;
      setSources((previous) => previous.includes(source.id) ? previous : [...previous, source.id]);
      setSelectedSourceDetails((previous) => ({ ...previous, [source.id]: source }));
      return;
    }
    setSources((previous) => previous.filter((id) => id !== source.id));
    setSelectedSourceDetails((previous) => {
      const next = { ...previous };
      delete next[source.id];
      return next;
    });
  }
  return <form onSubmit={save} className="flex flex-col gap-5">
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${id}-question`}>Pertanyaan acuan</FieldLabel><Textarea id={`${id}-question`} value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <Field><FieldLabel htmlFor={`${id}-answer`}>Jawaban koreksi</FieldLabel><Textarea id={`${id}-answer`} value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={10} maxLength={2000} required disabled={pending} /><FieldDescription>{answer.length}/2000 karakter. Markdown didukung.</FieldDescription>{answer.trim() && <details className="rounded-lg border px-3 py-2"><summary className="w-fit cursor-pointer text-sm font-medium">Pratinjau format jawaban</summary><FeedbackMarkdown content={answer} className="mt-3" /></details>}</Field>
      <Field><FieldLabel htmlFor={`${id}-rationale`}>Alasan perbaikan</FieldLabel><Textarea id={`${id}-rationale`} value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <FieldSet><FieldLegend variant="label">Sumber pendukung · {sources.length}/5 dipilih</FieldLegend>
        <FieldDescription>{copy && !copy.sourceCurrent ? "Sumber versi yang disalin sudah berubah. Hapus sumber lama dan pilih potongan terkini. " : ""}Pilih potongan materi yang mendukung koreksi. Ada {data.totalSources.toLocaleString("id-ID")} potongan; cari isi atau judul materi untuk mempersempit daftar.</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setSourcePickerOpen(true)}><Search data-icon="inline-start" />Pilih sumber</Button>
          <Badge variant={sources.length > 0 ? "secondary" : "outline"}>{sources.length} dari 5 dipilih</Badge>
          {sources.length > 0 && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setSources([]); setSelectedSourceDetails({}); }}>Kosongkan</Button>}
        </div>
        {sources.length > 0 && <ul className="flex flex-col gap-2" aria-label="Sumber terpilih">
          {sources.map((sourceId) => {
            const source = selectedSourceDetails[sourceId];
            if (!source) return null;
            return <li key={sourceId} className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{source.title} · Halaman {source.pageNumber} · Potongan {source.chunkIndex + 1}</p><p className="line-clamp-2 text-sm text-muted-foreground">{source.snippet}</p></div>
              <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={() => toggleSource(source, false)} aria-label={`Hapus sumber ${source.title}, halaman ${source.pageNumber}`}><X data-icon="inline-start" /></Button>
            </li>;
          })}
        </ul>}
        <Dialog open={sourcePickerOpen} onOpenChange={setSourcePickerOpen}>
          <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Pilih potongan sumber</DialogTitle>
              <DialogDescription>Cari di antara {data.totalSources.toLocaleString("id-ID")} potongan materi. Pilihanmu tetap tersimpan saat berpindah halaman.</DialogDescription>
              <div className="flex gap-2 pt-2">
                <Input aria-label="Cari judul materi atau isi potongan" value={searchDraft} maxLength={100} placeholder="Cari istilah, topik, atau judul materi" onChange={(event) => onSearchDraftChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSearch(searchDraft.trim()); onPageChange(1); } }} />
                <Button type="button" variant="outline" disabled={sourcesLoading} onClick={() => { onSearch(searchDraft.trim()); onPageChange(1); }}><Search data-icon="inline-start" />Cari</Button>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1 text-sm text-muted-foreground"><span>{data.totalSources.toLocaleString("id-ID")} hasil{activeSearch ? ` untuk “${activeSearch}”` : ""}</span><Badge variant="secondary">{sources.length}/5 dipilih</Badge></div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {sourcesLoading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Mencari potongan…</p> : data.sources.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil. Coba kata kunci lain; hanya materi aktif yang selesai diproses bisa dipilih.</p> : <div className="flex flex-col gap-2">
                {data.sources.map((source) => <Field key={source.id} orientation="horizontal" className="items-start rounded-lg border px-3 py-3">
                  <Checkbox id={`${id}-${source.id}`} checked={sources.includes(source.id)} disabled={pending || (!sources.includes(source.id) && sources.length >= 5)} onCheckedChange={(checked) => toggleSource({ id: source.id, title: source.title, pageNumber: source.pageNumber, chunkIndex: source.chunkIndex, snippet: source.snippet }, checked === true)} />
                  <div className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-${source.id}`} className="flex flex-col gap-1"><span>{source.title} · Halaman {source.pageNumber} · Potongan {source.chunkIndex + 1}</span><span className="line-clamp-3 font-normal text-muted-foreground">{source.snippet}</span></FieldLabel>
                    <details className="mt-2 text-sm"><summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Lihat seluruh potongan</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-muted-foreground">{source.content}</p></details>
                  </div>
                </Field>)}
              </div>}
            </div>
            <DialogFooter className="flex-row items-center justify-between border-t px-6 py-4 sm:justify-between">
              <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={sourcesLoading || data.sourcePage <= 1} onClick={() => onPageChange(data.sourcePage - 1)}>Sebelumnya</Button><span className="min-w-24 text-center text-xs text-muted-foreground">Halaman {data.sourcePage} dari {Math.max(1, Math.ceil(data.totalSources / data.sourcePageSize))}</span><Button type="button" variant="outline" size="sm" disabled={sourcesLoading || data.sourcePage * data.sourcePageSize >= data.totalSources} onClick={() => onPageChange(data.sourcePage + 1)}>Berikutnya</Button></div>
              <Button type="button" onClick={() => setSourcePickerOpen(false)}>Selesai · {sources.length}/5</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FieldSet>
    </FieldGroup>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{saved && <p role="status" className="text-sm">{saved}</p>}
    <Button type="submit" disabled={pending || sources.length === 0} className="self-start">{pending ? "Menyimpan…" : "Simpan sebagai versi baru"}</Button>
  </form>;
}
