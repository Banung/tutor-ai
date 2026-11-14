"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Play, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { feedbackReasons } from "@/lib/tutor-ai/feedback-schema";
import type { ReviewAction } from "@/lib/tutor-ai/feedback-review-schema";
import type { FeedbackReviewDetail } from "./feedback-review-types";
import { ReviewStatusBadge, reviewDate, reviewResponse, reviewStatusLabel } from "./feedback-review-shared";

export function FeedbackReviewDetailPanel({ feedbackId }: { feedbackId: string }) {
  const [item, setItem] = useState<FeedbackReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const endpoint = `/api/dosen/feedback/${encodeURIComponent(feedbackId)}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: "no-store" })
      .then(reviewResponse<FeedbackReviewDetail>)
      .then((result) => { if (!controller.signal.aborted) { setItem(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) { setItem(null); setError(error instanceof Error ? error.message : "Gagal memuat detail."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, refresh]);

  async function changeStatus(status: ReviewAction) {
    if (!item || saving) return;
    setSaving(true); setError(null); setAnnouncement("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedRevision: item.reviewRevision }),
      });
      const updated = await reviewResponse<FeedbackReviewDetail>(response);
      setItem(updated); setAnnouncement("Status review tersimpan.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal menyimpan review.");
      // Require an explicit reload after an uncertain/conflicting write.
      setItem(null);
    } finally { setSaving(false); }
  }

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-3"><Button asChild variant="ghost" size="sm" className="self-start"><Link href="/dosen/feedback"><ArrowLeft data-icon="inline-start" />Antrean feedback</Link></Button><h1 className="text-2xl font-semibold tracking-tight">Tinjau feedback jawaban</h1><p className="text-sm text-muted-foreground">Hanya jawaban yang dilaporkan dan pertanyaan terkait yang ditampilkan.</p></div>
      <Button variant="outline" disabled={loading || saving} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw data-icon="inline-start" />Muat ulang detail</Button>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p role="status" className="sr-only">{announcement}</p>
    {loading ? <Skeleton className="h-96 rounded-xl" aria-label="Memuat detail feedback" /> : item && <>
      <div className="flex flex-wrap items-center gap-3"><h2 className="font-medium">{item.course.title}</h2><ReviewStatusBadge status={item.reviewStatus} /></div>
      {item.value !== "negative" && <p role="status" className="text-sm text-muted-foreground">Mahasiswa telah mengubah penilaian menjadi membantu. Feedback ditarik dari antrean negatif; riwayat review tetap tersedia.</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader><CardTitle>Pertanyaan terkait</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm">{item.question ?? "Pertanyaan terkait tidak tersedia pada riwayat lama."}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Jawaban Tutor AI</CardTitle><CardDescription>Jawaban asli yang mendapat feedback mahasiswa.</CardDescription></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.answer}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Sumber jawaban</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{item.sources.length ? item.sources.map((source, index) => <div key={`${source.title}-${source.pageNumber}-${index}`} className="flex flex-col gap-1"><p className="text-sm font-medium">{source.title} · Halaman {source.pageNumber}</p>{source.snippet && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{source.snippet}</p>}</div>) : <p className="text-sm text-muted-foreground">Tidak ada sumber tersimpan untuk jawaban ini.</p>}</CardContent></Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader><CardTitle>Feedback mahasiswa</CardTitle><CardDescription>Aktivitas terakhir {reviewDate(item.updatedAt)}</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p className="text-sm">{item.value === "negative" ? "Kurang membantu" : "Membantu"}</p><p className="text-sm text-muted-foreground">{feedbackReasons[item.reason as keyof typeof feedbackReasons] ?? "Tanpa alasan tambahan"}</p><p className="whitespace-pre-wrap break-words text-sm">{item.note || "Tidak ada catatan tambahan."}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Status review</CardTitle><CardDescription>Menandai selesai hanya mencatat peninjauan. Tindakan ini belum mengubah jawaban atau pengetahuan tutor.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><ReviewStatusBadge status={item.reviewStatus} />{item.reviewer && <p className="text-sm">Peninjau: {item.reviewer.name}</p>}{item.reviewedAt && <p className="text-sm text-muted-foreground">Selesai {reviewDate(item.reviewedAt)}</p>}{item.reviewStatus === "in_review" && item.actions.length === 0 && <p className="text-sm text-muted-foreground">Review sedang dikerjakan dosen lain.</p>}</CardContent><CardFooter className="flex flex-wrap gap-2">{item.actions.map((action) => <Button key={action} variant={action === "pending" ? "outline" : "default"} disabled={saving} onClick={() => void changeStatus(action)}>{saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : action === "completed" ? <Check data-icon="inline-start" /> : action === "pending" ? <Undo2 data-icon="inline-start" /> : <Play data-icon="inline-start" />}{action === "completed" ? "Selesai ditinjau" : action === "pending" ? "Kembalikan ke antrean" : item.reviewStatus === "completed" ? "Tinjau kembali" : "Mulai tinjau"}</Button>)}</CardFooter></Card>
        </div>
      </div>
      <ReviewHistory item={item} />
    </>}
  </div>;
}

function ReviewHistory({ item }: { item: FeedbackReviewDetail }) {
  return <Card><CardHeader><CardTitle>Riwayat feedback dan review</CardTitle><CardDescription>Perubahan penilaian mahasiswa dan keputusan dosen tetap tercatat. Menampilkan hingga 100 perubahan terbaru.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
    {item.reviewEvents.length === 0 && <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan. Feedback ini mungkin dibuat sebelum pencatatan review diaktifkan.</p>}
    {item.reviewEvents.map((event) => <details key={event.id} className="rounded-lg border p-4"><summary className="cursor-pointer text-sm"><span className="font-medium">{event.eventType === "status_changed" ? "Status review diubah" : event.eventType === "feedback_changed" ? "Feedback diubah" : "Feedback dikirim"}</span><span className="text-muted-foreground"> · {event.actorRole === "dosen" ? event.actorName ?? "Dosen" : "Mahasiswa"} · {reviewDate(event.createdAt)}</span></summary><div className="mt-3 flex flex-col gap-3 text-sm"><p>{event.fromStatus ? `${reviewStatusLabel(event.fromStatus)} → ` : ""}{reviewStatusLabel(event.toStatus)}</p>{event.feedbackBefore && <Snapshot title="Sebelumnya" snapshot={event.feedbackBefore} />}{event.feedbackAfter && <Snapshot title="Penilaian saat perubahan" snapshot={event.feedbackAfter} />}</div></details>)}
  </CardContent></Card>;
}

function Snapshot({ title, snapshot }: { title: string; snapshot: NonNullable<FeedbackReviewDetail["reviewEvents"][number]["feedbackBefore"]> }) {
  return <div className="flex flex-col gap-1"><p className="font-medium">{title}: {snapshot.value === "negative" ? "Kurang membantu" : "Membantu"}</p>{snapshot.reason && <p className="text-muted-foreground">{feedbackReasons[snapshot.reason as keyof typeof feedbackReasons] ?? snapshot.reason}</p>}{snapshot.note && <p className="whitespace-pre-wrap break-words">{snapshot.note}</p>}</div>;
}
