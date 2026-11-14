"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { correctionStatusLabels } from "@/lib/tutor-ai/correction-schema";
import { reviewDate, reviewResponse } from "./feedback-review-shared";
import type { CorrectionVersion } from "./correction-types";

export function CorrectionVersionCard({ version, onChanged, onCopy, courseTitle }: { version: CorrectionVersion; onChanged: () => void; courseTitle?: string; onCopy?: (version: CorrectionVersion) => void }) {
  const [action, setAction] = useState<"approve" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!action || pending) return;
    setPending(true); setError(null);
    try {
      const payload = action === "approve" ? { action, expectedActiveVersionId: version.activeVersion?.id ?? null }
        : { action, expectedActiveVersionId: version.id, reason };
      await reviewResponse(await fetch(`/api/dosen/corrections/${version.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      setAction(null); onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Tindakan belum dapat disimpan.");
      if ((error as { status?: number }).status === 409) { setAction(null); onChanged(); }
    } finally { setPending(false); }
  }
  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><CardTitle>Versi {version.version} · {version.question}</CardTitle><Badge variant={version.effectiveStatus === "needs_review" ? "destructive" : "outline"}>{correctionStatusLabels[version.effectiveStatus] ?? version.effectiveStatus}</Badge></div><CardDescription>{courseTitle ? `${courseTitle} · ` : ""}{version.authorName} · {reviewDate(version.createdAt)}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap break-words text-sm">{version.answer}</p><p className="text-sm text-muted-foreground">Alasan: {version.rationale}</p>
      <ul className="flex list-inside list-disc flex-col gap-1 text-sm">{version.sourceSnapshot.map((source) => <li key={source.chunkId}>{source.materialTitle} · Halaman {source.pageNumber}</li>)}</ul>
      {version.approvedAt && <p className="text-sm text-muted-foreground">Disetujui {version.approvedByName} · {reviewDate(version.approvedAt)}</p>}
      {version.withdrawnAt && <p className="text-sm text-muted-foreground">Dicabut {version.withdrawnByName} · {reviewDate(version.withdrawnAt)} · {version.withdrawalReason}</p>}
      {!version.sourceCurrent && <p role="status" className="text-sm text-muted-foreground">Sumber berubah, tidak aktif, atau belum siap. Koreksi ini tidak digunakan tutor. Buat versi baru dengan sumber terkini.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent>
    <CardFooter className="flex flex-wrap gap-2">
      {version.status === "draft" && version.sourceCurrent && <Button disabled={pending} onClick={() => { setError(null); setAction("approve"); }}>Tinjau dan setujui</Button>}
      {version.status === "approved" && <Button variant="outline" disabled={pending} onClick={() => { setError(null); setReason(""); setAction("withdraw"); }}>Cabut koreksi</Button>}
      {onCopy && <Button variant="outline" disabled={pending} onClick={() => onCopy(version)}>Salin ke versi baru</Button>}
      {!onCopy && version.feedbackId && <Button asChild variant="ghost"><Link href={`/dosen/feedback/${version.feedbackId}`}>Buka feedback asal</Link></Button>}
    </CardFooter>
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !pending) setAction(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{action === "approve" ? "Setujui koreksi jawaban" : "Cabut koreksi aktif"}</DialogTitle><DialogDescription>{action === "approve" ? "Koreksi yang disetujui dapat menjadi konteks jawaban berikutnya pada mata kuliah ini. Pastikan sumber mendukung isinya." : "Koreksi berhenti dipakai untuk jawaban berikutnya. Versi dan riwayat jawaban lama tetap tersimpan."}</DialogDescription></DialogHeader>
      <p className="whitespace-pre-wrap break-words text-sm">{version.answer}</p>
      {action === "approve" && version.activeVersion && <div className="flex flex-col gap-2"><p className="text-sm font-medium">Akan menggantikan versi aktif {version.activeVersion.version}:</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{version.activeVersion.answer}</p></div>}
      {action === "withdraw" && <FieldGroup><Field><FieldLabel htmlFor={`withdraw-${version.id}`}>Alasan pencabutan</FieldLabel><Textarea id={`withdraw-${version.id}`} value={reason} maxLength={500} disabled={pending} onChange={(event) => setReason(event.target.value)} /></Field></FieldGroup>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setAction(null)}>Batal</Button><Button disabled={pending || (action === "withdraw" && reason.trim().length < 3)} onClick={() => void submit()}>{pending ? "Memproses…" : action === "approve" ? "Setujui dan aktifkan" : "Cabut koreksi"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Card>;
}
