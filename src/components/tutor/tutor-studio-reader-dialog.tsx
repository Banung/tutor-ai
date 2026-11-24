"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildStudioArtifactMarkdown,
  buildStudioExportFilename,
  buildStudioPrintableHtml,
} from "@/lib/tutor-ai/studio-export";
import {
  TUTOR_STUDIO_TYPE_META,
  type TutorStudioArtifactDto,
} from "@/lib/tutor-ai/studio-schema";
import {
  buildCitationPreviewState,
  CitationPreviewSheet,
  extractRagSources,
  groupCitationSources,
  linkifySourceCitations,
  MessageSources,
  type CitationPreviewState,
} from "./tutor-citation-preview";
import { MarkdownPre, MarkdownTable } from "./tutor-chat-messages";

/** Trigger a client-side Markdown (.md) download for a Studio artifact. */
export function downloadStudioMarkdown(artifact: TutorStudioArtifactDto) {
  const markdown = buildStudioArtifactMarkdown(artifact);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = buildStudioExportFilename(artifact.title, "md");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function collectDocumentStyleTagsHtml(): string {
  const nodes = document.querySelectorAll('link[rel="stylesheet"], style');
  const htmlParts: string[] = [];
  nodes.forEach((node) => {
    if (node.tagName === "LINK") {
      const href = (node as HTMLLinkElement).href;
      if (href) {
        htmlParts.push(`<link rel="stylesheet" href="${href}" />`);
      }
    } else if (node.tagName === "STYLE") {
      htmlParts.push(`<style>${node.textContent ?? ""}</style>`);
    }
  });
  return htmlParts.join("\n");
}

function formatReaderDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function TutorStudioReaderDialog({
  artifact,
  onOpenChange,
}: {
  artifact: TutorStudioArtifactDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [citationPreview, setCitationPreview] = useState<CitationPreviewState | null>(null);
  const [printingPdf, setPrintingPdf] = useState(false);

  const sources = useMemo(
    () => (artifact ? extractRagSources(artifact.sources) : []),
    [artifact]
  );
  const sourceGroups = useMemo(() => groupCitationSources(sources), [sources]);

  const openSource = (sourceNumber: number) => {
    const previewState = buildCitationPreviewState(
      sourceGroups,
      sourceNumber,
      artifact?.title ?? ""
    );
    if (previewState) {
      setCitationPreview(previewState);
    }
  };

  const handleDownloadPdf = () => {
    if (!artifact || !proseRef.current) return;
    setPrintingPdf(true);

    const renderedBodyHtml = proseRef.current.innerHTML;
    const styleTagsHtml = collectDocumentStyleTagsHtml();
    const printableHtml = buildStudioPrintableHtml({
      artifact,
      renderedBodyHtml,
      styleTagsHtml,
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.setAttribute("aria-hidden", "true");

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
        setPrintingPdf(false);
      }, 400);
    };

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        toast.error("Browser tidak mendukung pencetakan PDF langsung.");
        cleanup();
        return;
      }

      const handleAfterPrint = () => {
        printWindow.removeEventListener("afterprint", handleAfterPrint);
        cleanup();
      };
      printWindow.addEventListener("afterprint", handleAfterPrint);

      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          toast.error("Gagal membuka dialog simpan PDF.");
        } finally {
          window.setTimeout(cleanup, 1200);
        }
      }, 150);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = printableHtml;
  };

  return (
    <>
      <Dialog
        open={Boolean(artifact)}
        onOpenChange={(open) => {
          if (!open) {
            setCitationPreview(null);
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {artifact && (
            <>
              <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-14">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {TUTOR_STUDIO_TYPE_META[artifact.type].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatReaderDate(artifact.updatedAt)}
                  </span>
                </div>
                <DialogTitle className="mt-1 text-left text-lg leading-snug">
                  {artifact.title}
                </DialogTitle>
                <DialogDescription className="text-left text-xs">
                  {artifact.materialTitles.length > 0
                    ? `Sumber: ${artifact.materialTitles.join(", ")}`
                    : TUTOR_STUDIO_TYPE_META[artifact.type].description}
                </DialogDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadStudioMarkdown(artifact)}
                  >
                    <Download data-icon="inline-start" />
                    Unduh .md
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={printingPdf}
                    onClick={handleDownloadPdf}
                  >
                    <Printer data-icon="inline-start" />
                    {printingPdf ? "Menyiapkan PDF..." : "Unduh PDF"}
                  </Button>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div
                  ref={proseRef}
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

                        return (
                          <a href={href} title={title}>
                            {children}
                          </a>
                        );
                      },
                      pre: MarkdownPre,
                      table: MarkdownTable,
                    }}
                  >
                    {linkifySourceCitations(artifact.content)}
                  </ReactMarkdown>
                </div>

                {sourceGroups.length > 0 && (
                  <MessageSources
                    sourceGroups={sourceGroups}
                    relatedQuestion={artifact.title}
                    onOpenSource={openSource}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CitationPreviewSheet
        preview={citationPreview}
        onOpenChange={setCitationPreview}
      />
    </>
  );
}
