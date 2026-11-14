"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { feedbackReasons } from "@/lib/tutor-ai/feedback-schema";
import { ReviewStatusBadge, reviewDate, reviewResponse } from "./feedback-review-shared";
import type { FeedbackQueue } from "./feedback-review-types";

export function FeedbackReviewQueue() {
  const [courseId, setCourseId] = useState("all");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<FeedbackQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ status, page: String(page) });
    if (courseId !== "all") query.set("courseId", courseId);
    fetch(`/api/dosen/feedback?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(reviewResponse<FeedbackQueue>)
      .then((result) => { if (!controller.signal.aborted) { setData(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : "Gagal memuat feedback."); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, status, page, refresh]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value); setPage(1); setLoading(true); setError(null);
  }
  function reload() { setLoading(true); setError(null); setRefresh((value) => value + 1); }

  return <div className="mx-auto flex max-w-6xl flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2"><h1 className="text-2xl font-semibold tracking-tight">Feedback Jawaban</h1><p className="text-sm text-muted-foreground">Tinjau jawaban yang dinilai kurang membantu pada mata kuliah yang Anda ampu.</p></div>
      <Button variant="outline" onClick={reload} disabled={loading}><RefreshCw data-icon="inline-start" />Muat ulang</Button>
    </header>
    <FieldGroup className="flex flex-col gap-4 sm:flex-row">
      <Field><FieldLabel htmlFor="feedback-course">Mata kuliah</FieldLabel><Select value={courseId} onValueChange={(value) => changeFilter(setCourseId, value)} disabled={loading}>
        <SelectTrigger id="feedback-course"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
          <SelectItem value="all">Semua mata kuliah</SelectItem>{data?.courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select></Field>
      <Field><FieldLabel htmlFor="feedback-status">Status review</FieldLabel><Select value={status} onValueChange={(value) => changeFilter(setStatus, value)} disabled={loading}>
        <SelectTrigger id="feedback-status"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
          <SelectItem value="all">Semua status</SelectItem><SelectItem value="pending">Belum ditinjau</SelectItem><SelectItem value="in_review">Sedang ditinjau</SelectItem><SelectItem value="completed">Selesai ditinjau</SelectItem>
        </SelectGroup></SelectContent>
      </Select></Field>
    </FieldGroup>
    {error && <div className="flex flex-col items-start gap-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={reload}>Coba lagi</Button></div>}
    {loading ? <div className="grid gap-4 md:grid-cols-2" aria-label="Memuat antrean feedback">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-52 rounded-xl" />)}</div> : data && <>
      <p className="text-sm text-muted-foreground" role="status">{data.total} feedback negatif sesuai filter. Penilaian positif tidak masuk antrean ini.</p>
      {data.items.length === 0 ? <p role="status" className="py-12 text-center text-muted-foreground">Tidak ada feedback pada filter ini.</p> : <div className="grid gap-4 md:grid-cols-2">
        {data.items.map((item) => <Card key={item.id}>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{item.course.title}</CardTitle><ReviewStatusBadge status={item.reviewStatus} /></div><CardDescription>{reviewDate(item.updatedAt)}{item.reviewer ? ` · ${item.reviewer.name}` : ""}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3"><p className="line-clamp-3 text-sm">{item.answerPreview}</p><p className="text-sm text-muted-foreground">{feedbackReasons[item.reason as keyof typeof feedbackReasons] ?? "Tanpa alasan tambahan"}</p>{item.note && <p className="line-clamp-2 text-sm">“{item.note}”</p>}</CardContent>
          <CardFooter className="mt-auto"><Button asChild variant="outline"><Link href={`/dosen/feedback/${item.id}`}>Lihat dan tinjau<ArrowRight data-icon="inline-end" /></Link></Button></CardFooter>
        </Card>)}
      </div>}
      <nav className="flex items-center justify-between gap-3" aria-label="Halaman antrean feedback">
        <Button variant="outline" disabled={page === 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Sebelumnya</Button><span className="text-sm text-muted-foreground">Halaman {page}</span><Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => { setPage(page + 1); setLoading(true); }}>Berikutnya</Button>
      </nav>
    </>}
  </div>;
}
