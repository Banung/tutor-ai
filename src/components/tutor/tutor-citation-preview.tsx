"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink, FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { RagSource } from "./tutor-chat-types";

const SOURCE_KEYWORD_STOPWORDS = new Set([
  "about", "after", "also", "among", "because", "being", "between", "could", "does", "from", "have", "into", "more", "most", "other", "over", "same", "should", "some", "source", "such", "than", "that", "their", "there", "these", "they", "this", "those", "through", "under", "using", "very", "what", "when", "where", "which", "while", "were", "with", "would",
  "akan", "atau", "bagi", "bahwa", "banyak", "belum", "bisa", "dalam", "dan", "dapat", "dari", "dengan", "di", "ini", "itu", "juga", "karena", "ke", "lebih", "oleh", "pada", "para", "saat", "sebagai", "secara", "sehingga", "seperti", "sudah", "sumber", "telah", "tentang", "tersebut", "tidak", "untuk", "yang",
]);

export type CitationEvidence = {
  source: RagSource;
  sourceNumber: number;
};

export type CitationSourceGroup = {
  materialId: string;
  materialTitle: string;
  fileName: string;
  publicUrl: string | null;
  sessionTitle: string;
  evidence: CitationEvidence[];
  sourceNumbers: number[];
};

export type CitationPreviewState = {
  group: CitationSourceGroup;
  focusedChunkId: string;
  pageNumber: number;
  relatedTopic: string | null;
};

/** Extract typed RagSource entries from message or artifact metadata. */
export function extractRagSources(rawMetadata: unknown): RagSource[] {
  const candidateArray = Array.isArray(rawMetadata)
    ? rawMetadata
    : rawMetadata &&
        typeof rawMetadata === "object" &&
        "sources" in rawMetadata &&
        Array.isArray((rawMetadata as { sources?: unknown }).sources)
      ? (rawMetadata as { sources: unknown[] }).sources
      : [];

  return candidateArray.filter((item): item is RagSource => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.materialTitle === "string" &&
      typeof candidate.pageNumber === "number" &&
      typeof candidate.chunkId === "string"
    );
  });
}

function countSourceTerms(text: string) {
  const counts = new Map<string, number>();
  for (const match of text.toLocaleLowerCase().matchAll(/[\p{L}\p{N}][\p{L}\p{N}-]{3,}/gu)) {
    const term = match[0].replace(/-+$/g, "");
    if (term.length < 4 || SOURCE_KEYWORD_STOPWORDS.has(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

function normalizeSourceTerm(term: string) {
  const normalized = term.toLocaleLowerCase();
  if (normalized.endsWith("ies") && normalized.length > 5) return `${normalized.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes|oes)$/.test(normalized) && normalized.length > 5) {
    return normalized.slice(0, -2);
  }
  if (normalized.endsWith("s") && normalized.length > 4 && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function getRelatedTopic(evidence: CitationEvidence[], question: string) {
  const questionTerms = [...countSourceTerms(question).keys()];
  const pageTerms = new Set(
    [...countSourceTerms(evidence.map(({ source }) => source.snippet).join(" ")).keys()]
      .map(normalizeSourceTerm)
  );
  let bestPhrase: string[] = [];
  let currentPhrase: string[] = [];

  for (const term of questionTerms) {
    if (pageTerms.has(normalizeSourceTerm(term))) {
      currentPhrase.push(term);
      if (currentPhrase.length > bestPhrase.length) bestPhrase = [...currentPhrase];
    } else {
      currentPhrase = [];
    }
  }

  return bestPhrase.length > 0 ? bestPhrase.join(" ") : null;
}

function getMostRelatedEvidence(evidence: CitationEvidence[], question: string) {
  return (
    [...evidence].sort((left, right) => {
      const leftTopic = getRelatedTopic([left], question);
      const rightTopic = getRelatedTopic([right], question);
      const topicLength = (topic: string | null) => topic?.split(/\s+/).length ?? 0;
      return (
        topicLength(rightTopic) - topicLength(leftTopic) ||
        right.source.similarity - left.source.similarity
      );
    })[0] ?? null
  );
}

function splitSourceSentences(text: string) {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text)]
      .map(({ segment }) => segment.trim())
      .filter(Boolean);
  }

  return (text.match(/[^.!?]+[.!?]*/gu) ?? [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getSentenceExcerpt(text: string, topic: string | null, sentenceLimit: number) {
  const sentences = splitSourceSentences(text);
  if (sentences.length <= sentenceLimit) return text;

  const topicTerms = new Set([...countSourceTerms(topic ?? "").keys()].map(normalizeSourceTerm));
  const relatedSentenceIndex = sentences.findIndex((sentence) =>
    [...countSourceTerms(sentence).keys()].some((term) => topicTerms.has(normalizeSourceTerm(term)))
  );
  const startIndex = relatedSentenceIndex < 0 ? 0 : Math.max(0, relatedSentenceIndex - 1);
  const endIndex = Math.min(sentences.length, startIndex + sentenceLimit);
  const prefix = startIndex > 0 ? "… " : "";
  const suffix = endIndex < sentences.length ? " …" : "";

  return `${prefix}${sentences.slice(startIndex, endIndex).join(" ")}${suffix}`;
}

function highlightSourceKeyword(text: string, keyword: string | null): ReactNode {
  if (!keyword) return text;

  const terms = [...countSourceTerms(keyword).keys()];
  if (terms.length === 0) return text;
  const pattern = terms
    .map((term) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `${escapedTerm}(?:es|s)?`;
    })
    .join("|");
  const parts = text.split(new RegExp(`\\b(${pattern})\\b`, "gi"));
  const keywordTerms = new Set(terms.map(normalizeSourceTerm));
  return parts.map((part, index) =>
    keywordTerms.has(normalizeSourceTerm(part)) ? (
      <mark
        key={`${keyword}-${index}`}
        className="rounded-sm bg-amber-300/45 px-0.5 font-medium text-foreground dark:bg-amber-300/25"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function groupCitationSources(sources: RagSource[]): CitationSourceGroup[] {
  const groups = new Map<string, CitationSourceGroup>();

  sources.forEach((source, index) => {
    const sourceNumber = source.sourceNumber ?? index + 1;
    const key = source.materialId || `source-${sourceNumber}`;
    let group = groups.get(key);

    if (!group) {
      group = {
        materialId: source.materialId,
        materialTitle: source.materialTitle,
        fileName: source.fileName,
        publicUrl: source.publicUrl ?? null,
        sessionTitle: source.sessionTitle,
        evidence: [],
        sourceNumbers: [],
      };
      groups.set(key, group);
    }

    if (!group.evidence.some(({ source: item }) => item.chunkId === source.chunkId)) {
      group.evidence.push({ source, sourceNumber });
    }
    if (!group.sourceNumbers.includes(sourceNumber)) {
      group.sourceNumbers.push(sourceNumber);
    }
  });

  return [...groups.values()];
}

export function linkifySourceCitations(markdown: string) {
  const codeSegment = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

  return markdown
    .split(codeSegment)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;

      return segment.replace(
        /\[((?:Sumber\s+\d+)(?:\s*,\s*(?:Sumber\s+)?\d+)*)\]/gi,
        (citation, group: string) => {
          const sourceNumbers = [...group.matchAll(/(?:Sumber\s+)?(\d+)/gi)].map((match) =>
            Number(match[1])
          );
          const uniqueSourceNumbers = [...new Set(sourceNumbers)];

          if (uniqueSourceNumbers.length === 0) return citation;

          return uniqueSourceNumbers
            .map((sourceNumber) => `[Sumber ${sourceNumber}](#tutor-source-${sourceNumber})`)
            .join(", ");
        }
      );
    })
    .join("");
}

/** Resolve the CitationPreviewState corresponding to a cited [Sumber N] link click. */
export function buildCitationPreviewState(
  sourceGroups: CitationSourceGroup[],
  sourceNumber: number,
  relatedQuestion: string
): CitationPreviewState | null {
  const group = sourceGroups.find((item) =>
    item.evidence.some((evidence) => evidence.sourceNumber === sourceNumber)
  );
  const matchingEvidence = group?.evidence.filter(
    (evidence) => evidence.sourceNumber === sourceNumber
  );
  const target =
    (matchingEvidence && getMostRelatedEvidence(matchingEvidence, relatedQuestion)) ??
    matchingEvidence?.[0];

  if (!group || !target) return null;

  return {
    group,
    focusedChunkId: target.source.chunkId,
    pageNumber: target.source.pageNumber,
    relatedTopic: getRelatedTopic(
      group.evidence.filter(({ source }) => source.pageNumber === target.source.pageNumber),
      relatedQuestion
    ),
  };
}

function getPdfPageUrl(publicUrl: string | null, pageNumber: number) {
  if (!publicUrl || !Number.isInteger(pageNumber) || pageNumber < 1) return null;

  try {
    const url = new URL(publicUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = `page=${pageNumber}`;
    return url.toString();
  } catch {
    return null;
  }
}

export function MessageSources({
  sourceGroups,
  relatedQuestion,
  onOpenSource,
}: {
  sourceGroups: CitationSourceGroup[];
  relatedQuestion: string;
  onOpenSource: (sourceNumber: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (sourceGroups.length === 0) return null;

  return (
    <div className="mt-5 border-t border-border/50 pt-3">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground/60 transition-transform duration-200",
            isOpen && "rotate-90 text-brand"
          )}
        />
        <span>Sumber ({sourceGroups.reduce((count, group) => count + group.sourceNumbers.length, 0)})</span>
      </button>

      {isOpen && (
        <div className="mt-3 flex flex-col gap-2.5 pl-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
          {sourceGroups.map((group) => {
            const pages = [...new Set(group.evidence.map(({ source }) => source.pageNumber))].sort(
              (left, right) => left - right
            );
            const relatedEvidence = getMostRelatedEvidence(group.evidence, relatedQuestion);
            const relatedTopic = relatedEvidence
              ? getRelatedTopic([relatedEvidence], relatedQuestion)
              : null;

            return (
              <button
                key={group.materialId || group.materialTitle}
                type="button"
                onClick={() =>
                  onOpenSource(relatedEvidence?.sourceNumber ?? group.sourceNumbers[0] ?? 1)
                }
                className="group flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-card/45 p-3 text-left text-xs text-muted-foreground transition-all hover:border-brand/35 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {group.materialTitle}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {pages.length > 0 ? `Hal. ${pages.join(", ")}` : "Kutipan materi"}
                        {group.evidence.length > 1 ? ` · ${group.evidence.length} kutipan` : ""}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </span>
                <span className="flex flex-wrap items-center gap-1.5 pl-5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                    Topik terkait
                  </span>
                  {relatedTopic ? (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                      {relatedTopic}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Konteks materi</span>
                  )}
                </span>
                {relatedEvidence?.source.snippet && (
                  <span className="pl-5 text-[11px] leading-relaxed text-muted-foreground/90">
                    {highlightSourceKeyword(
                      getSentenceExcerpt(relatedEvidence.source.snippet, relatedTopic, 2),
                      relatedTopic
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CitationPreviewSheet({
  preview,
  onOpenChange,
}: {
  preview: CitationPreviewState | null;
  onOpenChange: (preview: CitationPreviewState | null) => void;
}) {
  const group = preview?.group;
  const evidence = preview
    ? group?.evidence.filter(({ source }) => source.pageNumber === preview.pageNumber) ?? []
    : [];
  const orderedEvidence = [...evidence].sort(
    (left, right) => left.source.chunkIndex - right.source.chunkIndex
  );

  return (
    <Sheet
      open={Boolean(preview)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      <SheetContent side="right" className="w-[min(92vw,28rem)] gap-0 p-0 sm:max-w-[28rem]">
        <SheetHeader className="border-b border-border px-5 py-5 pr-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
            Pratinjau sumber
          </p>
          <SheetTitle className="break-words text-left leading-snug">
            {group?.materialTitle ?? "Sumber materi"}
          </SheetTitle>
          <SheetDescription className="break-all text-left text-xs">
            {group?.fileName ?? ""}
            {group?.sessionTitle ? ` · ${group.sessionTitle}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/70 px-5 py-3">
            <p className="text-sm font-medium text-foreground">Kutipan yang mendukung jawaban</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {evidence.length} potongan dari halaman PDF {preview?.pageNumber}
            </p>
            {preview?.relatedTopic && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                  Topik terkait
                </span>
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                  {preview.relatedTopic}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-3">
              {orderedEvidence.map(({ source }, excerptIndex) => {
                const pdfPageUrl = getPdfPageUrl(group?.publicUrl ?? null, source.pageNumber);
                const isFocused = source.chunkId === preview?.focusedChunkId;

                return (
                  <article
                    key={source.chunkId}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      isFocused ? "border-brand/35 bg-brand/5" : "border-border/70 bg-card"
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-foreground">
                        Kutipan {excerptIndex + 1} dari {orderedEvidence.length} · Halaman PDF{" "}
                        {source.pageNumber}
                      </p>
                      {pdfPageUrl && (
                        <a
                          href={pdfPageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand underline-offset-4 hover:underline"
                        >
                          Buka halaman
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <blockquote className="border-l-2 border-brand/35 pl-3 text-sm leading-relaxed text-muted-foreground">
                      {source.snippet
                        ? highlightSourceKeyword(source.snippet, preview?.relatedTopic ?? null)
                        : "Kutipan teks tidak tersedia untuk potongan ini."}
                    </blockquote>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
