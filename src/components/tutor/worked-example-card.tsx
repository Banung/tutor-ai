"use client";

import { useState } from "react";
import { parseWorkedExample } from "@/lib/tutor-ai/worked-example";
import { Button } from "@/components/ui/button";

export function WorkedExampleCard({ value }: { value: string }) {
  const example = parseWorkedExample(value);
  const [visibleSteps, setVisibleSteps] = useState(1);
  if (!example) return <pre className="whitespace-pre-wrap">{value}</pre>;

  return (
    <section aria-label="Contoh langkah pengerjaan" className="not-prose my-5 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <div className="border-b border-border px-5 py-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pelajari langkahnya</p>
        <h3 className="font-semibold">{example.title}</h3>
      </div>
      <ol className="space-y-4 px-5 py-4" aria-live="polite">
        {example.steps.slice(0, visibleSteps).map((step, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
            <div className="min-w-0"><p className="font-medium">{step.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{step.explanation}</p></div>
          </li>
        ))}
      </ol>
      {visibleSteps >= example.steps.length && <p className="mx-5 mb-4 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm"><strong>Hasil: </strong>{example.result}</p>}
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="text-xs text-muted-foreground">{Math.min(visibleSteps, example.steps.length)} dari {example.steps.length} langkah</span>
        {visibleSteps < example.steps.length ? <Button size="sm" onClick={() => setVisibleSteps((count) => count + 1)}>Langkah berikutnya</Button> : <Button size="sm" variant="ghost" onClick={() => setVisibleSteps(1)}>Ulangi</Button>}
      </div>
    </section>
  );
}
