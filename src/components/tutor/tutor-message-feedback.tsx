"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { feedbackReasons, type TutorFeedback, type TutorFeedbackValue } from "@/lib/tutor-ai/feedback-schema";

export function TutorMessageFeedback({ courseId, sessionId, messageId, initialFeedback }: {
  courseId: string; sessionId: string; messageId: string; initialFeedback?: TutorFeedback | null;
}) {
  const fieldId = useId();
  const [saved, setSaved] = useState(initialFeedback ?? null);
  const [value, setValue] = useState<TutorFeedbackValue["value"]>(saved?.value ?? "positive");
  const [reason, setReason] = useState(saved?.reason ?? "none");
  const [note, setNote] = useState(saved?.note ?? "");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(nextValue: string) {
    if (nextValue !== "positive" && nextValue !== "negative") return;
    setValue(nextValue);
    setReason(saved?.reason ?? "none");
    setNote(saved?.note ?? "");
    setError(null);
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/tutor/sessions/${sessionId}/messages/${messageId}/feedback`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, reason: reason === "none" ? null : reason, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Gagal menyimpan feedback");
      setSaved(data);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal menyimpan feedback. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ToggleGroup type="single" size="sm" value={saved?.value ?? ""} onValueChange={(next) => edit(next || saved?.value || "positive")} aria-label="Nilai jawaban Tutor AI">
        <ToggleGroupItem value="positive" aria-label="Jawaban membantu" title="Jawaban membantu"><ThumbsUp /></ToggleGroupItem>
        <ToggleGroupItem value="negative" aria-label="Jawaban tidak membantu" title="Jawaban tidak membantu"><ThumbsDown /></ToggleGroupItem>
      </ToggleGroup>
      {saved && <Button type="button" variant="ghost" size="sm" onClick={() => edit(saved.value)}><Check data-icon="inline-start" />Edit feedback</Button>}
      <span className="sr-only" role="status">{saved ? "Feedback tersimpan" : ""}</span>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{saved ? "Ubah feedback jawaban" : "Beri feedback jawaban"}</DialogTitle>
            <DialogDescription>Bagaimana jawaban ini membantu kamu memahami materi?</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-5">
            <FieldGroup>
              <Field data-disabled={pending}>
                <FieldLabel id={`${fieldId}-rating`}>Penilaian</FieldLabel>
                <ToggleGroup type="single" variant="outline" value={value} disabled={pending} onValueChange={(next) => { if (next === "positive" || next === "negative") setValue(next); }} aria-labelledby={`${fieldId}-rating`}>
                  <ToggleGroupItem value="positive"><ThumbsUp />Membantu</ToggleGroupItem>
                  <ToggleGroupItem value="negative"><ThumbsDown />Tidak membantu</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field data-disabled={pending}>
                <FieldLabel htmlFor={`${fieldId}-reason`}>Alasan (opsional)</FieldLabel>
                <Select value={reason} onValueChange={setReason} disabled={pending}>
                  <SelectTrigger id={`${fieldId}-reason`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem value="none">Tanpa alasan</SelectItem>
                    {Object.entries(feedbackReasons).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field data-disabled={pending}>
                <FieldLabel htmlFor={`${fieldId}-note`}>Catatan (opsional)</FieldLabel>
                <Textarea id={`${fieldId}-note`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={pending} aria-describedby={`${fieldId}-count`} placeholder="Ceritakan bagian yang membantu atau perlu diperbaiki…" />
                <FieldDescription id={`${fieldId}-count`}>{note.length}/500 karakter</FieldDescription>
              </Field>
            </FieldGroup>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 data-icon="inline-start" className="animate-spin" />}{pending ? "Menyimpan…" : error ? "Coba simpan lagi" : "Simpan feedback"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
