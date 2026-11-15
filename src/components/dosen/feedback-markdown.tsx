"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

export function FeedbackMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-ul:my-3 prose-ol:my-3 prose-li:my-1", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
