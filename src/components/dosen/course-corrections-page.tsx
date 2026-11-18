"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CorrectionVersionCard } from "./correction-version-card";
import { reviewResponse } from "./feedback-review-shared";
import type { CourseCorrectionsData } from "./correction-types";

export function CourseCorrectionsPage() {
  const [courseId, setCourseId] = useState("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<CourseCorrectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); const query = new URLSearchParams({ page: String(page) });
    if (courseId !== "all") query.set("courseId", courseId);
    fetch(`/api/dosen/corrections?${query}`, { signal: controller.signal, cache: "no-store" }).then(reviewResponse<CourseCorrectionsData>)
      .then((result) => { if (!controller.signal.aborted) { setData(result); setError(null); } })
      .catch((error) => { if (!controller.signal.aborted) { setData(null); setError(error instanceof Error ? error.message : "Gagal memuat koreksi."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, page, refresh]);
  function reload() { setLoading(true); setRefresh((n) => n + 1); }
  return <div className="mx-auto flex max-w-5xl flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="flex flex-col gap-2"><h1 className="text-2xl font-semibold">Koreksi Jawaban</h1><p className="text-sm text-muted-foreground">Kelola versi acuan Tutor pada mata kuliah yang Anda ampu.</p></div><Button variant="outline" disabled={loading} onClick={reload}>Muat ulang</Button></header>
    <Field><FieldLabel htmlFor="correction-course-filter">Mata kuliah</FieldLabel><Select value={courseId} disabled={loading} onValueChange={(value) => { setCourseId(value); setPage(1); setLoading(true); }}><SelectTrigger id="correction-course-filter"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Semua mata kuliah</SelectItem>{data?.courses.map((course) => <SelectItem value={course.id} key={course.id}>{course.title}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <Skeleton className="h-64 rounded-xl" /> : data && <>
      <p role="status" className="text-sm text-muted-foreground">{data.total} versi koreksi sesuai filter. Draf dari review feedback dan penyelarasan tampil di sini.</p>
      {data.versions.map((version) => <CorrectionVersionCard key={version.id} version={version} courseTitle={data.courses.find((course) => course.id === version.courseId)?.title} onChanged={reload} />)}
      <nav className="flex items-center justify-between gap-2" aria-label="Halaman koreksi"><Button variant="outline" disabled={page === 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Sebelumnya</Button><span className="text-sm">Halaman {page}</span><Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => { setPage(page + 1); setLoading(true); }}>Berikutnya</Button></nav>
    </>}
  </div>;
}
