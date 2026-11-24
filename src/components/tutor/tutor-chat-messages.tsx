"use client";

import {
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  BookOpenCheck,
  Check,
  Copy,
  CornerDownRight,
  FileText,
  Loader2,
  Square,
  Volume2,
} from "lucide-react";
import { TutorMessageFeedback } from "./tutor-message-feedback";
import { WorkedExampleCard } from "./worked-example-card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildTutorActionSuggestions,
  parsePersistedSuggestedActions,
  type PersistedSuggestedAction,
  type TutorActionSuggestion,
} from "@/lib/tutor-ai/action-suggestions";
import type { TutorStudioArtifactType } from "@/lib/tutor-ai/studio-schema";
import { cn } from "@/lib/utils";
import {
  buildCitationPreviewState,
  CitationPreviewSheet,
  extractRagSources,
  groupCitationSources,
  linkifySourceCitations,
  MessageSources,
  type CitationPreviewState,
} from "./tutor-citation-preview";
import type { RagSource, TutorChatSession, TutorMessage } from "./tutor-chat-types";

function getMessageSources(message: TutorMessage): RagSource[] {
  return extractRagSources(message.ragSources);
}

function isSummaryResponse(message: TutorMessage) {
  if (!message.ragSources || typeof message.ragSources !== "object") return false;
  return (message.ragSources as { intent?: unknown }).intent === "summary";
}

function getUniqueSources(sources: RagSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.materialId}-${source.pageNumber}-${source.chunkIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


const TUTOR_SPEECH_RATE = 1.2;
const TUTOR_SPEECH_PITCH = 1;

function isEdgeBrowser() {
  return /EdgA|EdgiOS|Edg\//i.test(navigator.userAgent);
}

function looksLikeMarkdownTableRow(line: string) {
  const trimmedLine = line.trim();
  if (!trimmedLine.includes("|")) return false;

  const cells = trimmedLine
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return cells.length > 1 && cells.some(Boolean);
}

function looksLikeMarkdownTableDivider(line: string) {
  const trimmedLine = line.trim();
  if (!trimmedLine.includes("|")) return false;

  return /^:?-{3,}:?$/.test(trimmedLine)
    ? false
    : trimmedLine
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function replaceMarkdownTablesForSpeech(value: string) {
  const lines = value.split(/\r?\n/);
  const speechLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1] ?? "";

    if (looksLikeMarkdownTableRow(currentLine) && looksLikeMarkdownTableDivider(nextLine)) {
      speechLines.push("Ada tabel yang bisa dilihat di bawah ini.");
      index += 2;

      while (index < lines.length && looksLikeMarkdownTableRow(lines[index])) {
        index += 1;
      }

      index -= 1;
      continue;
    }

    speechLines.push(currentLine);
  }

  return speechLines.join("\n");
}

function prepareSpeechText(value: string) {
  const contentWithReadableBlocks = replaceMarkdownTablesForSpeech(value).replace(
    /```([a-zA-Z0-9_-]+)?[\s\S]*?```/g,
    (_, language: string | undefined) => {
      const languageText = language ? ` ${language}` : "";
      return ` Bagian kode${languageText} bisa dilihat di bawah ini. `;
    }
  );

  return contentWithReadableBlocks
    .replace(/`([^`]+)`/g, "kode $1")
    .replace(/!\[(.*?)\]\((.*?)\)/g, "Ada gambar yang bisa dilihat di bawah ini.")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\$\$[\s\S]*?\$\$/g, " Ada rumus yang bisa dilihat di bawah ini. ")
    .replace(/\$([^$]+)\$/g, "rumus $1")
    .replace(/[*_#>~|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBrowserVoices() {
  return window.speechSynthesis.getVoices();
}

const INDONESIAN_WORD_HINTS = ["adalah", "akan", "atau", "dalam", "dan", "dengan", "dari", "di", "ini", "itu", "jika", "karena", "ke", "pada", "sebagai", "tidak", "untuk", "yang"];
const ENGLISH_WORD_HINTS = ["a", "an", "and", "are", "as", "because", "for", "from", "if", "in", "is", "not", "of", "or", "that", "the", "then", "this", "to", "with"];

function countWordHints(words: string[], hints: string[]) {
  const hintSet = new Set(hints);
  return words.reduce((total, word) => total + (hintSet.has(word) ? 1 : 0), 0);
}

function detectSpeechLanguage(text: string): "id" | "en" {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const englishScore = countWordHints(words, ENGLISH_WORD_HINTS);
  const indonesianScore = countWordHints(words, INDONESIAN_WORD_HINTS);
  return englishScore > indonesianScore ? "en" : "id";
}

const TARGET_VOICES = {
  id: ["Google Bahasa Indonesia", "Microsoft Gadis Online", "Microsoft Gadis", "Damayanti", "Siti"],
  en: ["Google UK English Female", "Google US English Female", "Microsoft Aria Online", "Microsoft Jenny Online", "Microsoft Zira", "Samantha", "Victoria", "Jenny", "Aria"]
};

function chooseTutorVoice(voices: SpeechSynthesisVoice[], lang: "id" | "en") {
  const targets = TARGET_VOICES[lang];

  for (const target of targets) {
    const exactMatch = voices.find((v) => v.name.toLowerCase() === target.toLowerCase());
    if (exactMatch) return exactMatch;
    
    const partialMatch = voices.find((v) => v.name.toLowerCase().includes(target.toLowerCase()));
    if (partialMatch) return partialMatch;
  }

  const genericFemale = voices.find((v) => 
    v.lang.startsWith(lang) && 
    (v.name.toLowerCase().includes("female") || 
     v.name.toLowerCase().includes("woman") || 
     v.name.toLowerCase().includes("girl"))
  );
  if (genericFemale) return genericFemale;

  const anyFemale = voices.find((v) => 
    v.name.toLowerCase().includes("female") || 
    v.name.toLowerCase().includes("woman") || 
    v.name.toLowerCase().includes("girl")
  );
  if (anyFemale) return anyFemale;

  return voices.find(v => v.lang.startsWith(lang)) || voices[0] || null;
}



function extractTextFromReactNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextFromReactNode(node.props.children);
  }
  return "";
}

function CopyBlockButton({
  content,
  label = "Copy",
  copiedLabel = "Copied!",
  className,
}: {
  content: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("size-7", className)}
          onClick={handleCopy}
          aria-label={copied ? copiedLabel : label}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? copiedLabel : label}</TooltipContent>
    </Tooltip>
  );
}

type MarkdownPreProps = ComponentPropsWithoutRef<"pre"> & {
  node?: unknown;
  children?: ReactNode;
};

export function MarkdownPre({ node, children, ...props }: MarkdownPreProps) {
  void node;
  const codeElement = Array.isArray(children) ? children[0] : children;
  let codeString = "";
  let language = "";
  if (isValidElement<{ children?: ReactNode; className?: string }>(codeElement)) {
    codeString = extractTextFromReactNode(codeElement.props.children).replace(/\n$/, "");
    const match = /language-(\w+)/.exec(codeElement.props.className || "");
    if (match) language = match[1];
  }

  if (language === "tutorsteps") return <WorkedExampleCard value={codeString} />;

  return (
    <div className="my-5 overflow-hidden rounded-xl bg-zinc-950 dark:bg-zinc-900 border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950 border-b border-border/50">
        <span className="text-xs font-mono font-medium text-zinc-400">{language || "text"}</span>
        <CopyBlockButton 
          content={codeString} 
          label="Copy code" 
          copiedLabel="Copied!" 
          className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        />
      </div>
      <div className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <pre {...props} className={cn(props.className, "!m-0 !bg-transparent !p-0 font-mono text-zinc-50")}>
          {children}
        </pre>
      </div>
    </div>
  );
}

type MarkdownTableProps = ComponentPropsWithoutRef<"table"> & {
  node?: unknown;
  children?: ReactNode;
};

export function MarkdownTable({ node, children, ...props }: MarkdownTableProps) {
  void node;
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!tableRef.current) return;
    try {
      const html = tableRef.current.outerHTML;
      let tsv = "";
      const rows = tableRef.current.querySelectorAll("tr");
      rows.forEach((row) => {
        const cols = row.querySelectorAll("td, th");
        const rowData = Array.from(cols).map((col) => {
          return (col as HTMLElement).innerText.replace(/\n/g, " ").trim();
        });
        tsv += rowData.join("\t") + "\n";
      });

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        try {
          const item = new ClipboardItem({
            "text/plain": new Blob([tsv], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          });
          await navigator.clipboard.write([item]);
        } catch {
          await navigator.clipboard.writeText(tsv);
        }
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin tabel");
    }
  };

  return (
    <div className="group relative my-6">
      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-muted hover:text-foreground border-none"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : "Copy table"}</TooltipContent>
        </Tooltip>
      </div>
      <div className="w-full overflow-x-auto">
        <table ref={tableRef} {...props} className={cn(props.className, "w-full")}>
          {children}
        </table>
      </div>
    </div>
  );
}

export type TutorChatMessagesProps = {
  courseId: string;
  canGiveFeedback?: boolean;
  activeSession: TutorChatSession | null;
  loadingSession: boolean;
  sending: boolean;
  sendingStage?: "preparing" | "generating" | null;
  onCreateSummary?: (anchorMessageId: string) => void;
  onOpenStudioAction?: (suggestion: TutorActionSuggestion, message: TutorMessage) => void;
  onSaveToStudio?: (message: TutorMessage) => void;
  studioActionLoadingKey?: string | null;
  savingNoteMessageIds?: ReadonlySet<string>;
  studioArtifactsByMessage?: ReadonlyMap<string, Partial<Record<TutorStudioArtifactType, string>>>;
  dynamicSuggestionsByMessage?: ReadonlyMap<string, PersistedSuggestedAction[]>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export const TutorChatMessages = memo(function TutorChatMessages({
  courseId,
  canGiveFeedback = false,
  activeSession,
  loadingSession,
  sending,
  sendingStage,
  onCreateSummary,
  onOpenStudioAction,
  onSaveToStudio,
  studioActionLoadingKey,
  savingNoteMessageIds,
  studioArtifactsByMessage,
  dynamicSuggestionsByMessage,
  scrollContainerRef,
  messagesEndRef,
}: TutorChatMessagesProps) {
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRequestIdRef = useRef(0);
  const copiedTimeoutRef = useRef<number | null>(null);
  const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
  const isStreamingEmpty = sending && lastMessage?.senderType === "ai" && !lastMessage.content;
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [citationPreviewEntry, setCitationPreviewEntry] = useState<{
    sessionId: string | undefined;
    preview: CitationPreviewState;
  } | null>(null);
  const citationPreview =
    citationPreviewEntry && citationPreviewEntry.sessionId === activeSession?.id
      ? citationPreviewEntry.preview
      : null;
  const setCitationPreview = useCallback(
    (next: CitationPreviewState | null) => {
      setCitationPreviewEntry(
        next ? { sessionId: activeSession?.id, preview: next } : null
      );
    },
    [activeSession?.id]
  );

  const cancelCurrentSpeech = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    if (speechUtteranceRef.current) {
      speechUtteranceRef.current.onend = null;
      speechUtteranceRef.current.onerror = null;
    }

    window.speechSynthesis.cancel();
    speechUtteranceRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    speechRequestIdRef.current += 1;
    cancelCurrentSpeech();
    setSpeakingMessageId(null);
  }, [cancelCurrentSpeech]);

  useEffect(() => {
    return () => {
      speechRequestIdRef.current += 1;
      cancelCurrentSpeech();
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, [cancelCurrentSpeech]);

  async function handleCopyMessage(message: TutorMessage) {
    try {
      const plainText = message.content;
      let htmlContent = "";

      const element = document.getElementById(`markdown-content-${message.id}`);
      if (element) {
        const clone = element.cloneNode(true) as HTMLElement;
        // Remove streaming cursor from copied HTML if present
        const cursor = clone.querySelector(".animate-pulse");
        if (cursor) cursor.remove();
        
        // Wrap in a div to ensure it's a valid HTML block when pasted
        htmlContent = `<div>${clone.innerHTML}</div>`;
      }

      if (htmlContent && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        try {
          const clipboardItem = new ClipboardItem({
            "text/plain": new Blob([plainText], { type: "text/plain" }),
            "text/html": new Blob([htmlContent], { type: "text/html" }),
          });
          await navigator.clipboard.write([clipboardItem]);
        } catch {
          // Fallback if writing multiple formats fails
          await navigator.clipboard.writeText(plainText);
        }
      } else {
        await navigator.clipboard.writeText(plainText);
      }

      setCopiedMessageId(message.id);

      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
        copiedTimeoutRef.current = null;
      }, 1500);
    } catch {
      toast.error("Gagal menyalin jawaban Tutor AI.");
    }
  }

  function handleSpeakMessage(message: TutorMessage) {
    if (speakingMessageId === message.id) {
      stopSpeech();
      return;
    }

    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      toast.error("Browser ini tidak mendukung text-to-speech.");
      return;
    }

    const text = prepareSpeechText(message.content);
    if (!text) return;

    const requestId = speechRequestIdRef.current + 1;
    speechRequestIdRef.current = requestId;
    cancelCurrentSpeech();
    setSpeakingMessageId(message.id);

    const speechLanguage = detectSpeechLanguage(text);
    const selectedVoice = chooseTutorVoice(getBrowserVoices(), speechLanguage);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang || (speechLanguage === "en" ? "en-US" : "id-ID");
    utterance.rate = TUTOR_SPEECH_RATE;
    utterance.pitch = TUTOR_SPEECH_PITCH;
    utterance.volume = 1;
    utterance.onend = () => {
      if (speechRequestIdRef.current === requestId) stopSpeech();
    };
    utterance.onerror = (event) => {
      if (speechRequestIdRef.current !== requestId) return;

      stopSpeech();
      if (event.error !== "canceled" && event.error !== "interrupted") {
        toast.error(`Gagal memutar suara (${event.error}). Periksa pengaturan audio browser.`);
      }
    };

    speechUtteranceRef.current = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      stopSpeech();
      toast.error("Gagal memutar suara. Periksa pengaturan audio browser.");
    }
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div
        className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 pb-8 pt-4"
      >
        {loadingSession ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-20 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-16 w-1/2 rounded-2xl" />
            <Skeleton className="h-28 w-3/4 rounded-2xl" />
          </div>
        ) : !activeSession ? (
          <div className="min-h-[60vh]" aria-hidden="true" />
        ) : activeSession.messages.length === 0 ? (
          <div className="min-h-[60vh]" aria-hidden="true" />
        ) : (
          activeSession.messages.map((message, messageIndex) => {
            const isUser = message.senderType === "user";
            const sources = getUniqueSources(getMessageSources(message));
            const sourceGroups = groupCitationSources(sources);
            const isStreaming = sending && message.id.startsWith("streaming-");
            const canCreateSummary =
              !isUser &&
              !isStreaming &&
              !isSummaryResponse(message) &&
              message.content.trim().length > 0 &&
              sources.length > 0 &&
              Boolean(onCreateSummary);
            const relatedQuestion = isUser
              ? ""
              : activeSession.messages
                  .slice(0, messageIndex)
                  .reverse()
                  .find((previousMessage) => previousMessage.senderType === "user")?.content ?? "";

            const openSource = (sourceNumber: number) => {
              const previewState = buildCitationPreviewState(
                sourceGroups,
                sourceNumber,
                relatedQuestion
              );
              if (previewState) setCitationPreview(previewState);
            };
            const messageArtifactIds = studioArtifactsByMessage?.get(message.id);
            const persistedSuggestions =
              dynamicSuggestionsByMessage?.get(message.id) ??
              parsePersistedSuggestedActions(message.ragSources);
            const actionSuggestions =
              !isUser &&
              !isStreaming &&
              !isSummaryResponse(message) &&
              message.content.trim().length > 0 &&
              sources.length > 0 &&
              onOpenStudioAction
                ? buildTutorActionSuggestions({
                    messageId: message.id,
                    answerContent: message.content,
                    questionContent: relatedQuestion,
                    sourcesCount: sources.length,
                    existingSummaryArtifactId: messageArtifactIds?.SUMMARY ?? null,
                    existingQuizArtifactId: messageArtifactIds?.QUIZ ?? null,
                    existingFlashcardsArtifactId: messageArtifactIds?.FLASHCARDS ?? null,
                    persistedSuggestions,
                  })
                : [];
            const savedNoteId = messageArtifactIds?.NOTE ?? null;
            const isSavingNote = savingNoteMessageIds?.has(message.id) ?? false;

            // Skip rendering empty streaming messages — show spinner below instead
            if (isStreaming && !message.content) return null;

            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "rounded-2xl text-sm leading-relaxed",
                    isUser
                      ? "max-w-[85%] bg-primary px-4 py-3 text-primary-foreground"
                      : "w-full py-1 text-foreground"
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  ) : (
                    <>
                      <div 
                        id={`markdown-content-${message.id}`}
                        className="prose prose-base max-w-none break-words dark:prose-invert"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          components={{
                            a: ({ href, title, children }) => {
                              const citationMatch = href?.match(/^#tutor-source-(\d+)$/);
                              if (citationMatch) {
                                const sourceNumber = Number(citationMatch[1]);
                                const hasSource = sourceGroups.some((group) =>
                                  group.sourceNumbers.includes(sourceNumber)
                                );

                                if (!hasSource) {
                                  return <span className="text-muted-foreground">{children}</span>;
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => openSource(sourceNumber)}
                                    aria-label={`Buka pratinjau Sumber ${sourceNumber}`}
                                    className="inline-flex cursor-pointer items-baseline rounded bg-brand/10 px-1.5 py-0.5 text-[0.92em] font-medium text-brand underline decoration-brand/35 underline-offset-2 transition-colors hover:bg-brand/15 hover:decoration-brand"
                                  >
                                    {children}
                                  </button>
                                );
                              }

                              return <a href={href} title={title}>{children}</a>;
                            },
                            pre: MarkdownPre,
                            table: MarkdownTable,
                          }}
                        >
                          {linkifySourceCitations(message.content)}
                        </ReactMarkdown>
                        {isStreaming && (
                          <span className="inline-block h-4 w-0.5 animate-pulse bg-brand align-text-bottom" />
                        )}
                      </div>

                      {!isStreaming && (
                        <MessageSources
                          sourceGroups={sourceGroups}
                          relatedQuestion={relatedQuestion}
                          onOpenSource={openSource}
                        />
                      )}

                      {!isStreaming && message.content.trim() && (
                        <div className="mt-3 flex flex-wrap items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className={cn(
                                  "size-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
                                  speakingMessageId === message.id && "bg-muted text-foreground"
                                )}
                                onClick={() => void handleSpeakMessage(message)}
                                aria-label={
                                  speakingMessageId === message.id
                                    ? "Hentikan audio Tutor AI"
                                    : "Dengarkan jawaban Tutor AI"
                                }
                              >
                                {speakingMessageId === message.id ? (
                                  <Square className="size-3.5 fill-current" />
                                ) : (
                                  <Volume2 className="size-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {speakingMessageId === message.id ? "Stop" : "Speak"}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className={cn(
                                  "size-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
                                  copiedMessageId === message.id && "text-foreground"
                                )}
                                onClick={() => void handleCopyMessage(message)}
                                aria-label="Salin jawaban Tutor AI"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="size-4" />
                                ) : (
                                  <Copy className="size-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copiedMessageId === message.id ? "Copied" : "Copy Response"}
                            </TooltipContent>
                          </Tooltip>

                          {onSaveToStudio && !isSummaryResponse(message) && !message.id.startsWith("streaming-") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSavingNote}
                                  className={cn(
                                    "h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
                                    savedNoteId && "text-brand hover:text-brand"
                                  )}
                                  onClick={() => onSaveToStudio(message)}
                                  aria-label={
                                    savedNoteId
                                      ? "Buka catatan tersimpan di Studio"
                                      : "Simpan jawaban ke Studio"
                                  }
                                >
                                  {isSavingNote ? (
                                    <Loader2 data-icon="inline-start" className="animate-spin" />
                                  ) : savedNoteId ? (
                                    <BookmarkCheck data-icon="inline-start" />
                                  ) : (
                                    <BookmarkPlus data-icon="inline-start" />
                                  )}
                                  <span>{savedNoteId ? "Tersimpan di Studio" : "Simpan ke Studio"}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {savedNoteId ? "Buka catatan tersimpan di Studio" : "Simpan ke Studio"}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {canGiveFeedback && activeSession && !message.id.startsWith("streaming-") && (
                            <TutorMessageFeedback
                              key={`${message.id}-${message.feedback?.updatedAt ?? "none"}`}
                              courseId={courseId}
                              sessionId={activeSession.id}
                              messageId={message.id}
                              initialFeedback={message.feedback}
                            />
                          )}
                        </div>
                      )}

                      {actionSuggestions.length > 0 ? (
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          {actionSuggestions.map((suggestion) => {
                            const cardKey = `${suggestion.id}:${message.id}`;
                            const isLoadingCard = studioActionLoadingKey === cardKey;
                            const isSavedCard = Boolean(suggestion.alreadySavedArtifactId);
                            const isStudioTarget = suggestion.target === "studio";

                            return (
                              <button
                                key={suggestion.id}
                                type="button"
                                disabled={sending || Boolean(studioActionLoadingKey)}
                                onClick={() => onOpenStudioAction?.(suggestion, message)}
                                className="group flex min-h-[100px] w-full flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-muted/45 px-4 py-3.5 text-left transition-colors hover:border-border hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="line-clamp-3 text-[13px] font-normal leading-snug text-foreground">
                                  {suggestion.title}
                                </span>
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  {isLoadingCard ? (
                                    <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
                                  ) : isStudioTarget ? (
                                    <>
                                      {isSavedCard ? (
                                        <BookOpenCheck className="size-3.5 text-brand" aria-hidden="true" />
                                      ) : (
                                        <FileText className="size-3.5 text-brand" aria-hidden="true" />
                                      )}
                                      <span className="text-[11px] font-medium">
                                        {isSavedCard ? "Tersimpan di Studio" : "Studio"}
                                      </span>
                                    </>
                                  ) : (
                                    <CornerDownRight
                                      className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                                      aria-hidden="true"
                                    />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        canCreateSummary && (
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            disabled={sending}
                            onClick={() => onCreateSummary?.(message.id)}
                            aria-label="Buat artikel belajar mendalam dari jawaban ini"
                            className="mt-4 h-auto w-full justify-between gap-4 rounded-2xl border-border bg-card px-5 py-4 text-left whitespace-normal hover:bg-muted/60"
                          >
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                              <span className="font-medium text-foreground">Buat artikel belajar dari materi ini</span>
                              <span className="text-sm font-normal text-muted-foreground">
                                Satu bacaan utuh dengan penjelasan yang lebih mendalam
                              </span>
                            </span>
                            <ArrowRight data-icon="inline-end" className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          </Button>
                        )
                      )}
                    </>
                  )}

                </div>
              </div>
            );
          })
        )}

        {isStreamingEmpty && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {sendingStage === "generating"
                ? "Tutor AI sedang menyusun jawaban..."
                : "Tutor AI sedang menyiapkan materi..."}
            </div>
          </div>
        )}
        {/* Clearance for floating input area */}
        <div className="h-28" aria-hidden="true" />
        <div ref={messagesEndRef} />
      </div>
      <CitationPreviewSheet preview={citationPreview} onOpenChange={setCitationPreview} />
    </div>
  );
});
