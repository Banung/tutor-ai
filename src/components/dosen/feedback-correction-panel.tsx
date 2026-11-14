"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { reviewResponse } from "./feedback-review-shared";
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
  const endpoint = `/api/dosen/feedback/${feedbackId}/corrections`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?${new URLSearchParams({ search, page: String(page) })}`, { signal: controller.signal, cache: "no-store" })
      .then(reviewResponse<CorrectionEditorData>).then((result) => { if (!controller.signal.aborted) { setData(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Koreksi belum dapat dimuat."); });
    return () => controller.abort();
  }, [endpoint, search, page, refresh]);
  function reload() { setRefresh((n) => n + 1); }
  return <section className="flex flex-col gap-5" aria-label="Koreksi jawaban dosen">
    <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold">Koreksi jawaban</h2><p className="text-sm text-muted-foreground">Simpan versi baru, periksa sumbernya, lalu setujui secara terpisah. Koreksi hanya berlaku pada mata kuliah ini.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="ghost" onClick={reload}>Muat ulang koreksi</Button></p>}
    {!data && !error && <Skeleton className="h-64 rounded-xl" />}
    {data && <>
      <Card><CardHeader><CardTitle>Versi koreksi baru</CardTitle><CardDescription>Konten versi lama tetap tersimpan. Pilih maksimal lima potongan dari materi aktif yang sudah siap.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft); }}><Input aria-label="Cari potongan sumber" value={searchDraft} maxLength={100} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Cari judul materi atau isi sumber" /><Button variant="outline" type="submit">Cari sumber</Button></form>
        <CorrectionDraftForm key={`${copy?.id ?? "new"}-${copyRevision}`} data={data} copy={copy} endpoint={endpoint} onSaved={reload} />
        <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Sumber sebelumnya</Button><span className="text-sm text-muted-foreground">Halaman sumber {data.sourcePage} · {data.totalSources} potongan</span><Button variant="outline" disabled={page * data.sourcePageSize >= data.totalSources} onClick={() => setPage(page + 1)}>Sumber berikutnya</Button></div>
      </CardContent></Card>
      <h3 className="font-medium">Riwayat versi terkait</h3>
      {data.versions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada koreksi untuk feedback ini.</p>}
      {data.versions.map((version) => <CorrectionVersionCard key={version.id} version={version} onChanged={reload} onCopy={(version) => { setCopy(version); setCopyRevision((n) => n + 1); }} />)}
    </>}
  </section>;
}

function CorrectionDraftForm({ data, copy, endpoint, onSaved }: { data: CorrectionEditorData; copy: CorrectionVersion | null; endpoint: string; onSaved: () => void }) {
  const id = useId();
  const [question, setQuestion] = useState(copy?.question ?? data.question);
  const [answer, setAnswer] = useState(copy?.answer ?? "");
  const [rationale, setRationale] = useState(copy?.rationale ?? "");
  const [sources, setSources] = useState<string[]>(copy?.sourceSnapshot.map((source) => source.chunkId) ?? []);
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
  return <form onSubmit={save} className="flex flex-col gap-5">
    <FieldGroup>
      <Field><FieldLabel htmlFor={`${id}-question`}>Pertanyaan acuan</FieldLabel><Textarea id={`${id}-question`} value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <Field><FieldLabel htmlFor={`${id}-answer`}>Jawaban koreksi</FieldLabel><Textarea id={`${id}-answer`} value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={10} maxLength={2000} required disabled={pending} /><FieldDescription>{answer.length}/2000 karakter</FieldDescription></Field>
      <Field><FieldLabel htmlFor={`${id}-rationale`}>Alasan perbaikan</FieldLabel><Textarea id={`${id}-rationale`} value={rationale} onChange={(event) => setRationale(event.target.value)} minLength={3} maxLength={1000} required disabled={pending} /></Field>
      <FieldSet><FieldLegend variant="label">Sumber pendukung · {sources.length}/5 dipilih</FieldLegend><FieldDescription>{copy && !copy.sourceCurrent ? "Sumber versi yang disalin sudah berubah. Kosongkan pilihan dan pilih sumber terkini. " : ""}Pilih potongan yang mendukung koreksi. Pilihan tetap tersimpan saat berpindah halaman sumber.</FieldDescription>
        {data.sources.map((source) => <Field key={source.id} orientation="horizontal"><Checkbox id={`${id}-${source.id}`} checked={sources.includes(source.id)} disabled={pending || (!sources.includes(source.id) && sources.length >= 5)} onCheckedChange={(checked) => setSources((previous) => checked ? [...previous, source.id] : previous.filter((value) => value !== source.id))} /><FieldLabel htmlFor={`${id}-${source.id}`}><span className="flex flex-col gap-1"><span>{source.title} · Halaman {source.pageNumber}</span><span className="font-normal text-muted-foreground">{source.snippet}</span></span></FieldLabel></Field>)}
        {data.sources.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada potongan sumber sesuai pencarian. Materi harus aktif dan selesai diproses.</p>}
        <Button type="button" variant="outline" disabled={pending || sources.length === 0} onClick={() => setSources([])}>Kosongkan pilihan sumber</Button>
      </FieldSet>
    </FieldGroup>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{saved && <p role="status" className="text-sm">{saved}</p>}
    <Button type="submit" disabled={pending || sources.length === 0} className="self-start">{pending ? "Menyimpan…" : "Simpan sebagai versi baru"}</Button>
  </form>;
}
