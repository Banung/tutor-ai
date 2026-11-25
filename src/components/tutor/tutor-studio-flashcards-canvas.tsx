"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Shuffle,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  TutorStudioFlashcardsData,
  UpdateTutorStudioProgressInput,
} from "@/lib/tutor-ai/studio-interactive";
import type { TutorStudioArtifactDto } from "@/lib/tutor-ai/studio-schema";
import { cn } from "@/lib/utils";
import {
  chooseTutorVoice,
  detectSpeechLanguage,
  prepareSpeechText,
  TUTOR_SPEECH_PITCH,
  TUTOR_SPEECH_RATE,
} from "./tutor-chat-messages";
import {
  buildCitationPreviewState,
  CitationPreviewSheet,
  extractRagSources,
  groupCitationSources,
  linkifySourceCitations,
  type CitationPreviewState,
} from "./tutor-citation-preview";
import { downloadStudioMarkdown } from "./tutor-studio-reader-dialog";

export type TutorStudioFlashcardsCanvasProps = {
  artifact: TutorStudioArtifactDto;
  flashcardsData: TutorStudioFlashcardsData;
  onClose: () => void;
  onSaveProgress: (payload: UpdateTutorStudioProgressInput) => Promise<unknown>;
};

export function TutorStudioFlashcardsCanvas({
  artifact,
  flashcardsData,
  onClose,
  onSaveProgress,
}: TutorStudioFlashcardsCanvasProps) {
  const cards = flashcardsData.cards;
  const [cardOrder, setCardOrder] = useState<number[]>(() =>
    cards.map((_, index) => index)
  );
  const [orderPos, setOrderPos] = useState<number>(() =>
    Math.min(
      Math.max(0, flashcardsData.progress?.currentIndex ?? 0),
      Math.max(0, cards.length - 1)
    )
  );
  const [flipped, setFlipped] = useState(false);
  const [trackLearning, setTrackLearning] = useState<boolean>(
    () => flashcardsData.progress?.trackLearning ?? false
  );
  const [statusByCardId, setStatusByCardId] = useState<
    Record<string, "known" | "review">
  >(() => flashcardsData.progress?.statusByCardId ?? {});
  const [speaking, setSpeaking] = useState(false);
  const [citationPreview, setCitationPreview] = useState<CitationPreviewState | null>(
    null
  );

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sources = useMemo(() => extractRagSources(artifact.sources), [artifact.sources]);
  const sourceGroups = useMemo(() => groupCitationSources(sources), [sources]);

  const actualCardIndex = cardOrder[orderPos] ?? 0;
  const currentCard = cards[actualCardIndex] ?? cards[0];
  const currentCardStatus = currentCard ? statusByCardId[currentCard.id] : undefined;

  const { knownCount, reviewCount } = useMemo(() => {
    let known = 0;
    let review = 0;
    for (const card of cards) {
      if (statusByCardId[card.id] === "known") known += 1;
      else if (statusByCardId[card.id] === "review") review += 1;
    }
    return { knownCount: known, reviewCount: review };
  }, [cards, statusByCardId]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const goToPosition = useCallback(
    (nextPos: number) => {
      if (nextPos < 0 || nextPos >= cardOrder.length) return;
      stopSpeech();
      setFlipped(false);
      setOrderPos(nextPos);
      const nextActualIdx = cardOrder[nextPos] ?? nextPos;
      if (trackLearning) {
        void onSaveProgress({
          kind: "flashcards",
          trackLearning,
          statusByCardId,
          currentIndex: nextActualIdx,
        });
      }
    },
    [cardOrder, onSaveProgress, statusByCardId, stopSpeech, trackLearning]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        stopSpeech();
        setFlipped((prev) => !prev);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPosition(orderPos - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToPosition(orderPos + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPosition, orderPos, stopSpeech]);

  const handleSpeak = () => {
    if (!currentCard) return;
    if (speaking) {
      stopSpeech();
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Browser tidak mendukung pembacaan suara.");
      return;
    }

    const rawText = flipped ? currentCard.back : currentCard.front;
    const text = prepareSpeechText(rawText);
    if (!text) return;

    stopSpeech();
    const lang = detectSpeechLanguage(text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = chooseTutorVoice(voices, lang);

    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang || (lang === "en" ? "en-US" : "id-ID");
    utterance.rate = TUTOR_SPEECH_RATE;
    utterance.pitch = TUTOR_SPEECH_PITCH;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    utteranceRef.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleShuffle = () => {
    stopSpeech();
    setFlipped(false);
    const shuffled = [...cardOrder];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCardOrder(shuffled);
    setOrderPos(0);
    toast.success("Urutan flashcard diacak.");
  };

  const handleToggleTrackLearning = () => {
    const nextTrack = !trackLearning;
    setTrackLearning(nextTrack);
    void onSaveProgress({
      kind: "flashcards",
      trackLearning: nextTrack,
      statusByCardId,
      currentIndex: actualCardIndex,
    });
  };

  const handleMarkStatus = (status: "known" | "review") => {
    if (!currentCard) return;
    const nextStatus = { ...statusByCardId, [currentCard.id]: status };
    setStatusByCardId(nextStatus);

    const nextPos = orderPos < cardOrder.length - 1 ? orderPos + 1 : orderPos;
    const nextActual = cardOrder[nextPos] ?? actualCardIndex;

    void onSaveProgress({
      kind: "flashcards",
      trackLearning: true,
      statusByCardId: nextStatus,
      currentIndex: nextActual,
    });

    if (nextPos !== orderPos) {
      stopSpeech();
      setFlipped(false);
      setOrderPos(nextPos);
    }
  };

  const openSourceCitation = (sourceNumber: number) => {
    const previewState = buildCitationPreviewState(
      sourceGroups,
      sourceNumber,
      currentCard?.topic ?? artifact.title
    );
    if (previewState) {
      setCitationPreview(previewState);
    }
  };

  const progressPercent =
    cardOrder.length > 0
      ? Math.round(((orderPos + 1) / cardOrder.length) * 100)
      : 0;

  return (
    <aside
      aria-label="Dek Flashcard Interaktif Studio"
      className="flex h-full w-full flex-col bg-background"
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {artifact.title}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadStudioMarkdown(artifact)}
            aria-label="Unduh flashcard sebagai Markdown"
          >
            <Download data-icon="inline-start" />
            <span className="max-sm:hidden">.md</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup dek flashcard"
            className="text-muted-foreground hover:text-foreground"
          >
            <X />
          </Button>
        </div>
      </header>

      {/* Progress & Tracking Summary */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-6 py-3">
        <div
          role="progressbar"
          aria-valuenow={orderPos + 1}
          aria-valuemin={1}
          aria-valuemax={cardOrder.length}
          aria-label="Progres flashcard"
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {orderPos + 1}/{cardOrder.length}
        </span>
        {trackLearning && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {reviewCount} ulangi
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {knownCount} paham
            </span>
          </div>
        )}
      </div>

      {/* Main Card Deck Area */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-6">
        {currentCard && (
          <div
            className={cn(
              "flex min-h-[320px] w-full max-w-md flex-col justify-between rounded-3xl border shadow-sm transition-colors",
              flipped
                ? "border-primary/45 bg-primary/10 dark:bg-primary/20"
                : "border-border bg-card"
            )}
          >
            {/* Flip Trigger Body */}
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                setFlipped((prev) => !prev);
              }}
              aria-label={
                flipped
                  ? "Kartu sedang menampilkan jawaban. Klik untuk kembali ke pertanyaan."
                  : "Kartu sedang menampilkan pertanyaan. Klik untuk melihat jawaban."
              }
              className="flex flex-1 flex-col justify-between gap-4 p-6 text-center focus-visible:outline-none"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {currentCard.topic}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    flipped
                      ? "bg-background text-foreground shadow-xs"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {flipped ? "Jawaban" : "Pertanyaan"}
                </span>
              </div>

              <div className="prose prose-base max-w-none break-words text-center dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                >
                  {flipped ? currentCard.back : currentCard.front}
                </ReactMarkdown>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Klik kartu atau tekan Spasi untuk membalik
              </p>
            </button>

            {/* Card Utility Bar */}
            <div className="flex items-center justify-between gap-2 border-t border-border/50 px-5 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {flipped && currentCard.sourceNumbers.length > 0 && (
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => {
                        const match = href?.match(/^#tutor-source-(\d+)$/);
                        if (!match) return <span>{children}</span>;
                        const num = Number(match[1]);
                        return (
                          <button
                            type="button"
                            onClick={() => openSourceCitation(num)}
                            className="inline-flex cursor-pointer items-center rounded bg-brand/15 px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand/25"
                          >
                            {children}
                          </button>
                        );
                      },
                    }}
                  >
                    {linkifySourceCitations(
                      currentCard.sourceNumbers.map((n) => `[Sumber ${n}]`).join(" ")
                    )}
                  </ReactMarkdown>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleShuffle}
                  aria-label="Acak urutan kartu"
                  title="Acak urutan"
                >
                  <Shuffle />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSpeak}
                  aria-label={speaking ? "Hentikan suara" : "Bacakan kartu"}
                  title={speaking ? "Hentikan suara" : "Bacakan"}
                >
                  {speaking ? <Square className="fill-current" /> : <Volume2 />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tracked Mastery Controls */}
        {trackLearning && currentCard && (
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant={currentCardStatus === "review" ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleMarkStatus("review")}
            >
              <RotateCcw data-icon="inline-start" />
              Perlu diulang
            </Button>
            <Button
              type="button"
              variant={currentCardStatus === "known" ? "default" : "outline"}
              size="sm"
              onClick={() => handleMarkStatus("known")}
            >
              <Check data-icon="inline-start" />
              Sudah paham
            </Button>
          </div>
        )}

        {/* Bottom Deck Navigation & Tracking Switch */}
        <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={orderPos === 0}
              onClick={() => goToPosition(orderPos - 1)}
              aria-label="Kartu sebelumnya"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
              {orderPos + 1} dari {cardOrder.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={orderPos >= cardOrder.length - 1}
              onClick={() => goToPosition(orderPos + 1)}
              aria-label="Kartu berikutnya"
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              id="flashcards-track-label"
              className="text-xs font-medium text-muted-foreground"
            >
              Lacak pembelajaran
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={trackLearning}
              aria-labelledby="flashcards-track-label"
              onClick={handleToggleTrackLearning}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                trackLearning ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block size-4 rounded-full bg-background shadow-xs transition-transform",
                  trackLearning ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <CitationPreviewSheet
        preview={citationPreview}
        onOpenChange={setCitationPreview}
      />
    </aside>
  );
}
