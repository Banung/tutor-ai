"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Layers,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildQuizFollowUpTopic,
  evaluateQuizAttempt,
  OPTION_LETTERS,
  type TutorQuizQuestion,
  type TutorStudioQuizData,
  type UpdateTutorStudioProgressInput,
} from "@/lib/tutor-ai/studio-interactive";
import type {
  TutorStudioArtifactDto,
  TutorStudioGeneratableType,
} from "@/lib/tutor-ai/studio-schema";
import { cn } from "@/lib/utils";
import {
  buildCitationPreviewState,
  CitationPreviewSheet,
  extractRagSources,
  groupCitationSources,
  linkifySourceCitations,
  type CitationPreviewState,
} from "./tutor-citation-preview";
import { downloadStudioMarkdown } from "./tutor-studio-reader-dialog";

type QuizViewMode = "playing" | "results" | "review";

function InlineMarkdownText({
  text,
  compact = false,
  className,
}: {
  text: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose max-w-none break-words dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        compact ? "prose-sm text-sm" : "prose-base text-[15px]",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ScoreGaugeRing({
  correctCount,
  totalCount,
  skippedCount,
  wrongCount,
}: {
  correctCount: number;
  totalCount: number;
  skippedCount: number;
  wrongCount: number;
}) {
  const ratio = totalCount > 0 ? correctCount / totalCount : 0;
  const radius = 52;
  const halfCircumference = Math.PI * radius;
  const filledLength = Math.max(0, Math.min(halfCircumference, ratio * halfCircumference));

  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <div className="relative h-28 w-44">
        <svg viewBox="0 0 140 85" className="h-full w-full overflow-visible" aria-hidden="true">
          <path
            d="M 18 72 A 52 52 0 0 1 122 72"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-muted"
          />
          <path
            d="M 18 72 A 52 52 0 0 1 122 72"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${halfCircumference}`}
            className={cn(
              "transition-all duration-500",
              ratio >= 0.7
                ? "text-emerald-500"
                : ratio > 0
                  ? "text-brand"
                  : "text-destructive"
            )}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {correctCount}/{totalCount}
          </span>
          <span className="text-xs font-medium text-muted-foreground">Benar</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {skippedCount} dilewati · {wrongCount} salah
      </p>
    </div>
  );
}

export type TutorStudioQuizCanvasProps = {
  artifact: TutorStudioArtifactDto;
  quizData: TutorStudioQuizData;
  generatingFollowUpType: TutorStudioGeneratableType | null;
  onClose: () => void;
  onSaveProgress: (payload: UpdateTutorStudioProgressInput) => Promise<unknown>;
  onGenerateFollowUp: (type: "FLASHCARDS" | "SUMMARY", topic: string) => void;
};

export function TutorStudioQuizCanvas({
  artifact,
  quizData,
  generatingFollowUpType,
  onClose,
  onSaveProgress,
  onGenerateFollowUp,
}: TutorStudioQuizCanvasProps) {
  const questions = quizData.questions;
  const totalCount = questions.length;
  const initialIndex = Math.min(
    Math.max(0, quizData.attempt?.currentIndex ?? 0),
    Math.max(0, totalCount - 1)
  );

  const [answers, setAnswers] = useState<Record<string, number>>(
    () => quizData.attempt?.answers ?? {}
  );
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [mode, setMode] = useState<QuizViewMode>(
    () => (quizData.attempt?.completedAt ? "results" : "playing")
  );
  const [hintOpenById, setHintOpenById] = useState<Record<string, boolean>>({});
  const [savingFinal, setSavingFinal] = useState(false);
  const [citationPreview, setCitationPreview] = useState<CitationPreviewState | null>(
    null
  );

  const sources = useMemo(() => extractRagSources(artifact.sources), [artifact.sources]);
  const sourceGroups = useMemo(() => groupCitationSources(sources), [sources]);

  const { liveCorrectCount, liveWrongCount } = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const question of questions) {
      const selected = answers[question.id];
      if (selected === undefined) continue;
      if (selected === question.correctIndex) {
        correct += 1;
      } else {
        wrong += 1;
      }
    }
    return { liveCorrectCount: correct, liveWrongCount: wrong };
  }, [answers, questions]);

  const evaluation = useMemo(() => {
    if (
      mode === "results" &&
      quizData.attempt?.completedAt &&
      quizData.attempt.evaluation
    ) {
      return quizData.attempt.evaluation;
    }
    return evaluateQuizAttempt(quizData, answers);
  }, [answers, mode, quizData]);

  const followUpTopic = useMemo(
    () => buildQuizFollowUpTopic(artifact.title, quizData, answers),
    [answers, artifact.title, quizData]
  );

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const selectedChoice = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isQuestionAnswered = selectedChoice !== undefined;
  const showExplanation = isQuestionAnswered || mode === "review";
  const isHintOpen = currentQuestion ? Boolean(hintOpenById[currentQuestion.id]) : false;

  const progressPercent =
    mode === "results"
      ? 100
      : totalCount > 0
        ? Math.round(((currentIndex + 1) / totalCount) * 100)
        : 0;

  const openSourceCitation = (sourceNumber: number, topicText: string) => {
    const previewState = buildCitationPreviewState(
      sourceGroups,
      sourceNumber,
      topicText
    );
    if (previewState) {
      setCitationPreview(previewState);
    }
  };

  const handleSelectOption = (question: TutorQuizQuestion, optionIndex: number) => {
    if (mode === "review" || answers[question.id] !== undefined) return;
    const nextAnswers = { ...answers, [question.id]: optionIndex };
    setAnswers(nextAnswers);
    void onSaveProgress({
      kind: "quiz",
      answers: nextAnswers,
      currentIndex,
    });
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    if (mode === "playing") {
      void onSaveProgress({
        kind: "quiz",
        answers,
        currentIndex: nextIndex,
      });
    }
  };

  const handleNext = async () => {
    if (currentIndex < totalCount - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (mode === "playing") {
        void onSaveProgress({
          kind: "quiz",
          answers,
          currentIndex: nextIndex,
        });
      }
      return;
    }

    if (mode === "playing") {
      setSavingFinal(true);
      await onSaveProgress({
        kind: "quiz",
        answers,
        currentIndex,
        completed: true,
      });
      setSavingFinal(false);
    }
    setMode("results");
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setHintOpenById({});
    setMode("playing");
    void onSaveProgress({
      kind: "quiz",
      answers: {},
      currentIndex: 0,
      reset: true,
    });
  };

  const scoreRatio =
    evaluation.totalCount > 0 ? evaluation.correctCount / evaluation.totalCount : 0;
  const resultHeadline =
    scoreRatio >= 0.8
      ? "Bagus sekali! Penguasaan materi Anda sudah sangat kuat."
      : evaluation.correctCount > 0
        ? "Langkah yang bagus. Pelajari kembali bagian di area fokus agar makin mantap."
        : "Jangan menyerah. Pelajari kembali materinya dan coba lagi.";

  return (
    <aside
      aria-label="Kuis Interaktif Studio"
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
            aria-label="Unduh kuis sebagai Markdown"
          >
            <Download data-icon="inline-start" />
            <span className="max-sm:hidden">.md</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup kuis interaktif"
            className="text-muted-foreground hover:text-foreground"
          >
            <X />
          </Button>
        </div>
      </header>

      {/* Progress & Live Score Bar */}
      {mode !== "results" && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-6 py-3">
          <div
            role="progressbar"
            aria-valuenow={currentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={totalCount}
            aria-label="Progres pertanyaan kuis"
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {currentIndex + 1}/{totalCount}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              title="Jumlah jawaban salah"
              className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-destructive"
            >
              <X className="size-3" aria-hidden="true" />
              {liveWrongCount}
            </span>
            <span
              title="Jumlah jawaban benar"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              <Check className="size-3" aria-hidden="true" />
              {liveCorrectCount}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {mode === "results" ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-semibold text-foreground">Skor</p>
              <ScoreGaugeRing
                correctCount={evaluation.correctCount}
                totalCount={evaluation.totalCount}
                skippedCount={evaluation.skippedCount}
                wrongCount={evaluation.wrongCount}
              />
              <p className="mt-1 text-base font-medium text-foreground">
                {resultHeadline}
              </p>
            </div>

            <section className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-foreground">Keunggulan</h3>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {evaluation.strengths.map((item, idx) => (
                  <li key={`${item.title}-${idx}`}>
                    <span className="font-medium text-foreground">{item.title}:</span>{" "}
                    <InlineMarkdownText
                      text={item.detail}
                      compact
                      className="inline text-muted-foreground [&>p]:m-0 [&>p]:inline"
                    />
                  </li>
                ))}
              </ul>
            </section>

            {evaluation.focusAreas.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-sm font-semibold text-foreground">Area fokus</h3>
                <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {evaluation.focusAreas.map((item, idx) => (
                    <li key={`${item.title}-${idx}`}>
                      <span className="font-medium text-foreground">{item.title}:</span>{" "}
                      <InlineMarkdownText
                        text={item.detail}
                        compact
                        className="inline text-muted-foreground [&>p]:m-0 [&>p]:inline"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="border-t border-border pt-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Teruslah Belajar
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={generatingFollowUpType !== null}
                  onClick={() => onGenerateFollowUp("FLASHCARDS", followUpTopic)}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand/45 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Perbaiki
                    </span>
                    {generatingFollowUpType === "FLASHCARDS" ? (
                      <Loader2 className="size-4 animate-spin text-brand" />
                    ) : (
                      <Layers className="size-4 text-brand" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Kartu Tanya Jawab
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Buat set flashcard aktif dari konsep yang masih perlu diperkuat di kuis ini.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={generatingFollowUpType !== null}
                  onClick={() => onGenerateFollowUp("SUMMARY", followUpTopic)}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand/45 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Pelajari
                    </span>
                    {generatingFollowUpType === "SUMMARY" ? (
                      <Loader2 className="size-4 animate-spin text-brand" />
                    ) : (
                      <BookOpen className="size-4 text-brand" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Panduan belajar
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Buat ringkasan terstruktur mendalam ke Studio untuk memahami ulang topik sulit.
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          currentQuestion && (
            <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Pertanyaan {currentIndex + 1} · {currentQuestion.topic}
                </span>
                {mode === "review" && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Mode Tinjau
                  </span>
                )}
              </div>

              <InlineMarkdownText text={currentQuestion.question} />

              <div className="flex flex-col gap-2.5">
                {currentQuestion.options.map((optionText, optionIndex) => {
                  const isSelected = selectedChoice === optionIndex;
                  const isCorrect = optionIndex === currentQuestion.correctIndex;
                  const letter = OPTION_LETTERS[optionIndex];

                  return (
                    <button
                      key={`${currentQuestion.id}-${letter}`}
                      type="button"
                      disabled={isQuestionAnswered || mode === "review"}
                      onClick={() => handleSelectOption(currentQuestion, optionIndex)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                        !showExplanation &&
                          "border-border bg-card hover:border-brand/50 hover:bg-muted/50",
                        showExplanation &&
                          isCorrect &&
                          "border-emerald-500/70 bg-emerald-500/10 text-foreground",
                        showExplanation &&
                          isSelected &&
                          !isCorrect &&
                          "border-destructive/70 bg-destructive/10 text-foreground",
                        showExplanation &&
                          !isCorrect &&
                          !isSelected &&
                          "border-border/60 bg-card/50 opacity-70"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 text-sm font-semibold text-muted-foreground">
                          {letter}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <InlineMarkdownText text={optionText} compact />
                        </div>
                      </div>
                      {showExplanation && isCorrect && (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-label="Jawaban benar"
                        />
                      )}
                      {showExplanation && isSelected && !isCorrect && (
                        <X
                          className="mt-0.5 size-4 shrink-0 text-destructive"
                          aria-label="Jawaban salah"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {showExplanation && (
                <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/45 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {selectedChoice === currentQuestion.correctIndex
                      ? "Tepat"
                      : selectedChoice !== undefined
                        ? `Belum tepat (Benar: ${OPTION_LETTERS[currentQuestion.correctIndex]})`
                        : `Dilewati (Benar: ${OPTION_LETTERS[currentQuestion.correctIndex]})`}
                  </p>
                  <div className="prose prose-sm max-w-none break-words text-muted-foreground dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                      components={{
                        a: ({ href, title, children }) => {
                          const match = href?.match(/^#tutor-source-(\d+)$/);
                          if (match) {
                            const sourceNumber = Number(match[1]);
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  openSourceCitation(sourceNumber, currentQuestion.topic)
                                }
                                className="inline-flex cursor-pointer items-baseline rounded bg-brand/10 px-1.5 py-0.5 text-[0.92em] font-medium text-brand underline decoration-brand/35 underline-offset-2 hover:bg-brand/15"
                              >
                                {children}
                              </button>
                            );
                          }
                          return (
                            <a href={href} title={title}>
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {linkifySourceCitations(
                        `${currentQuestion.explanation}${
                          currentQuestion.sourceNumbers.length > 0
                            ? ` ${currentQuestion.sourceNumbers
                                .map((n) => `[Sumber ${n}]`)
                                .join(", ")}`
                            : ""
                        }`
                      )}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  aria-expanded={isHintOpen}
                  onClick={() =>
                    setHintOpenById((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !isHintOpen,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>Petunjuk</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      isHintOpen && "rotate-180"
                    )}
                  />
                </button>
                {isHintOpen && (
                  <div className="mt-2 rounded-xl border border-border/70 bg-muted/35 p-3 text-xs leading-relaxed text-muted-foreground">
                    <InlineMarkdownText text={currentQuestion.hint} compact />
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer Navigation */}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-3.5">
        {mode === "results" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentIndex(0);
                setMode("review");
              }}
            >
              Tinjau
            </Button>
            <Button type="button" variant="default" size="sm" onClick={handleRetake}>
              <RotateCcw data-icon="inline-start" />
              Ikuti kuis lagi
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {mode === "review" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("results")}
                >
                  Lihat Skor
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={handlePrevious}
              >
                Kembali
              </Button>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={savingFinal}
              onClick={() => void handleNext()}
            >
              {savingFinal
                ? "Menyimpan..."
                : currentIndex === totalCount - 1
                  ? mode === "review"
                    ? "Kembali ke Hasil"
                    : "Selesai & Lihat Skor"
                  : "Berikutnya"}
            </Button>
          </>
        )}
      </footer>

      <CitationPreviewSheet
        preview={citationPreview}
        onOpenChange={setCitationPreview}
      />
    </aside>
  );
}
