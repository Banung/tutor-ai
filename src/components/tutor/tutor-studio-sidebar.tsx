"use client";

import { useState } from "react";
import {
  Bookmark,
  BookOpen,
  Download,
  FileText,
  Layers,
  ListChecks,
  Loader2,
  MoreVertical,
  PanelRightClose,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TUTOR_STUDIO_TYPE_META,
  type TutorStudioArtifactDto,
  type TutorStudioArtifactType,
  type TutorStudioGeneratableType,
  type TutorStudioScope,
} from "@/lib/tutor-ai/studio-schema";
import type { TutorStudioFilterType } from "./hooks/use-tutor-studio";
import { cn } from "@/lib/utils";

const QUICK_GENERATE_ITEMS: Array<{
  type: TutorStudioGeneratableType;
  label: string;
  subtitle: string;
  Icon: typeof FileText;
}> = [
  {
    type: "SUMMARY",
    label: "Ringkasan",
    subtitle: "Artikel belajar",
    Icon: FileText,
  },
  {
    type: "QUIZ",
    label: "Kuis Latihan",
    subtitle: "Soal & pembahasan",
    Icon: ListChecks,
  },
  {
    type: "FLASHCARDS",
    label: "Flashcard",
    subtitle: "Kartu hafalan aktif",
    Icon: Layers,
  },
];

function getArtifactIcon(type: TutorStudioArtifactType) {
  switch (type) {
    case "SUMMARY":
      return FileText;
    case "QUIZ":
      return ListChecks;
    case "FLASHCARDS":
      return Layers;
    case "NOTE":
      return Bookmark;
  }
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export type TutorStudioSidebarProps = {
  open: boolean;
  onClose: () => void;
  selectedMaterialCount: number;
  totalMaterialCount: number;
  activeSessionId: string | null;
  artifacts: TutorStudioArtifactDto[];
  totalArtifactCount: number;
  loadingArtifacts: boolean;
  generatingType: TutorStudioGeneratableType | null;
  scope: TutorStudioScope;
  onScopeChange: (scope: TutorStudioScope) => void;
  typeFilter: TutorStudioFilterType;
  onTypeFilterChange: (typeFilter: TutorStudioFilterType) => void;
  renamingArtifactId: string | null;
  setRenamingArtifactId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (value: string) => void;
  savingRename: boolean;
  onRenameArtifact: (artifactId: string) => void;
  onRequestDeleteArtifact: (artifactId: string) => void;
  onOpenArtifact: (artifact: TutorStudioArtifactDto) => void;
  onDownloadMarkdown: (artifact: TutorStudioArtifactDto) => void;
  onQuickGenerate: (type: TutorStudioGeneratableType, topic?: string) => void;
};

export function TutorStudioSidebar({
  open,
  onClose,
  selectedMaterialCount,
  totalMaterialCount,
  activeSessionId,
  artifacts,
  totalArtifactCount,
  loadingArtifacts,
  generatingType,
  scope,
  onScopeChange,
  typeFilter,
  onTypeFilterChange,
  renamingArtifactId,
  setRenamingArtifactId,
  renameValue,
  setRenameValue,
  savingRename,
  onRenameArtifact,
  onRequestDeleteArtifact,
  onOpenArtifact,
  onDownloadMarkdown,
  onQuickGenerate,
}: TutorStudioSidebarProps) {
  const [topicInput, setTopicInput] = useState("");
  const canGenerate = selectedMaterialCount > 0 && generatingType === null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Panel Studio Tutor AI"
        className={cn(
          "flex h-full shrink-0 flex-col border-l border-border bg-card/55 transition-all duration-200",
          "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:bg-background max-lg:shadow-2xl",
          open
            ? "w-80 max-lg:w-[min(92vw,21rem)] max-lg:translate-x-0"
            : "w-0 overflow-hidden border-l-0 max-lg:w-80 max-lg:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Studio</span>
            {totalArtifactCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                {totalArtifactCount}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup panel Studio"
            className="text-muted-foreground hover:text-foreground"
          >
            <PanelRightClose />
          </Button>
        </div>

        {/* Quick Generate */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">Buat dari Materi</span>
            <span className="text-[11px] text-muted-foreground">
              {totalMaterialCount > 0
                ? `${selectedMaterialCount} PDF dipilih`
                : "Belum ada PDF"}
            </span>
          </div>

          <Input
            value={topicInput}
            onChange={(event) => setTopicInput(event.target.value)}
            placeholder="Fokus topik tertentu (opsional)..."
            className="h-8 text-xs"
            disabled={!canGenerate}
          />

          <div className="grid grid-cols-1 gap-2">
            {QUICK_GENERATE_ITEMS.map(({ type, label, subtitle, Icon }) => {
              const isBusy = generatingType === type;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => {
                    const topic = topicInput.trim() || undefined;
                    onQuickGenerate(type, topic);
                    if (topic) setTopicInput("");
                  }}
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-brand/45 hover:bg-muted/55 disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {isBusy ? "Menyusun dari PDF..." : subtitle}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scope & Type Filters */}
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(value) => {
                if (value === "course" || value === "session") {
                  onScopeChange(value);
                }
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <ToggleGroupItem value="course" className="flex-1 text-xs">
                Semua Course
              </ToggleGroupItem>
              <ToggleGroupItem
                value="session"
                disabled={!activeSessionId}
                className="flex-1 text-xs"
              >
                Sesi Ini
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Select
            value={typeFilter}
            onValueChange={(value) => onTypeFilterChange(value as TutorStudioFilterType)}
          >
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue placeholder="Semua tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">Semua tipe ({totalArtifactCount})</SelectItem>
                <SelectItem value="SUMMARY">Ringkasan</SelectItem>
                <SelectItem value="QUIZ">Kuis Latihan</SelectItem>
                <SelectItem value="FLASHCARDS">Flashcard</SelectItem>
                <SelectItem value="NOTE">Catatan Tersimpan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Saved Artifacts List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loadingArtifacts ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 px-4 py-8 text-center">
              <BookOpen className="size-6 text-brand" />
              <p className="text-xs font-semibold text-foreground">
                Output Studio tersimpan di sini
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Buat Ringkasan, Kuis, Flashcard, atau simpan jawaban penting dari chat untuk dibaca ulang kapan saja.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {artifacts.map((artifact) => {
                const Icon = getArtifactIcon(artifact.type);
                const meta = TUTOR_STUDIO_TYPE_META[artifact.type];
                const isRenaming = renamingArtifactId === artifact.id;

                return (
                  <div
                    key={artifact.id}
                    className="group flex items-start gap-2 rounded-xl border border-border/75 bg-background/85 p-2.5 transition-colors hover:border-brand/40"
                  >
                    {isRenaming ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <Input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              onRenameArtifact(artifact.id);
                            } else if (event.key === "Escape") {
                              setRenamingArtifactId(null);
                            }
                          }}
                          autoFocus
                          disabled={savingRename}
                          className="h-8 text-xs"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={savingRename}
                            onClick={() => setRenamingArtifactId(null)}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            disabled={savingRename || !renameValue.trim()}
                            onClick={() => onRenameArtifact(artifact.id)}
                          >
                            Simpan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenArtifact(artifact)}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left focus-visible:outline-none"
                        >
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-brand">
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-brand">
                              {artifact.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80">
                                {meta.shortLabel}
                              </span>
                              <span>{formatShortDate(artifact.updatedAt)}</span>
                            </span>
                          </span>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Aksi untuk ${artifact.title}`}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onSelect={() => onOpenArtifact(artifact)}>
                                <BookOpen />
                                Buka di Reader
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => onDownloadMarkdown(artifact)}>
                                <Download />
                                Unduh Markdown (.md)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRenamingArtifactId(artifact.id);
                                  setRenameValue(artifact.title);
                                }}
                              >
                                <Pencil />
                                Ubah judul
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => onRequestDeleteArtifact(artifact.id)}
                              >
                                <Trash2 />
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
