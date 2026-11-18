"use client";

import { useState } from "react";
import { Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CourseInvitationButton({ courseId }: { courseId: string }) {
  const [creating, setCreating] = useState(false);

  async function createAndCopy() {
    setCreating(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/invitation`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal membuat link undangan");
      await navigator.clipboard.writeText(data.url);
      toast.success("Link undangan disalin. Link sebelumnya sudah tidak berlaku.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat link undangan");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button variant="outline" className="w-full justify-between" onClick={createAndCopy} disabled={creating}>
      <span className="flex items-center gap-2">{creating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}Buat & salin link undangan</span>
      {!creating && <Copy className="size-3.5 text-muted-foreground" />}
    </Button>
  );
}
