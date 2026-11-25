"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  TutorStudioArtifactDto,
  TutorStudioArtifactType,
  TutorStudioGeneratableType,
  TutorStudioScope,
  TutorStudioSource,
} from "@/lib/tutor-ai/studio-schema";
import type { UpdateTutorStudioProgressInput } from "@/lib/tutor-ai/studio-interactive";

export type TutorStudioFilterType = "ALL" | TutorStudioArtifactType;

export function useTutorStudio({
  courseId,
  activeSessionId,
}: {
  courseId: string;
  activeSessionId: string | null;
}) {
  const [artifacts, setArtifacts] = useState<TutorStudioArtifactDto[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [generatingType, setGeneratingType] = useState<TutorStudioGeneratableType | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [savingNoteMessageIds, setSavingNoteMessageIds] = useState<Set<string>>(() => new Set());
  const [scope, setScope] = useState<TutorStudioScope>("course");
  const [typeFilter, setTypeFilter] = useState<TutorStudioFilterType>("ALL");
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const [renamingArtifactId, setRenamingArtifactId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  const [deleteArtifactId, setDeleteArtifactId] = useState<string | null>(null);
  const [deletingArtifact, setDeletingArtifact] = useState(false);

  const loadArtifacts = useCallback(async () => {
    setLoadingArtifacts(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/tutor/studio`);
      const data = (await response.json().catch(() => ({}))) as {
        artifacts?: TutorStudioArtifactDto[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Gagal memuat data Studio.");
      }
      setArtifacts(data.artifacts ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat Studio.");
    } finally {
      setLoadingArtifacts(false);
    }
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadArtifacts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadArtifacts]);

  const upsertArtifact = useCallback((artifact: TutorStudioArtifactDto) => {
    setArtifacts((prev) => {
      const filtered = prev.filter((item) => item.id !== artifact.id);
      return [artifact, ...filtered];
    });
  }, []);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      if (scope === "session") {
        if (!activeSessionId || artifact.chatSessionId !== activeSessionId) {
          return false;
        }
      }
      if (typeFilter !== "ALL" && artifact.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [artifacts, scope, activeSessionId, typeFilter]);

  const artifactsByMessage = useMemo(() => {
    const map = new Map<string, Partial<Record<TutorStudioArtifactType, string>>>();
    for (const artifact of artifacts) {
      if (!artifact.sourceMessageId) continue;
      const current = map.get(artifact.sourceMessageId) ?? {};
      if (!current[artifact.type]) {
        current[artifact.type] = artifact.id;
      }
      map.set(artifact.sourceMessageId, current);
    }
    return map;
  }, [artifacts]);

  const activeArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === activeArtifactId) ?? null,
    [artifacts, activeArtifactId]
  );

  const openArtifactById = useCallback(
    async (artifactId: string) => {
      const localMatch = artifacts.find((artifact) => artifact.id === artifactId);
      if (localMatch) {
        setActiveArtifactId(localMatch.id);
        return localMatch;
      }

      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/studio/${artifactId}`);
        const data = (await response.json().catch(() => ({}))) as {
          artifact?: TutorStudioArtifactDto;
          error?: string;
        };
        if (!response.ok || !data.artifact) {
          throw new Error(data.error ?? "Artefak Studio tidak ditemukan.");
        }
        upsertArtifact(data.artifact);
        setActiveArtifactId(data.artifact.id);
        return data.artifact;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal membuka artefak Studio.");
        return null;
      }
    },
    [artifacts, courseId, upsertArtifact]
  );

  const generateArtifact = useCallback(
    async (input: {
      type: TutorStudioGeneratableType;
      chatSessionId?: string | null;
      anchorMessageId?: string | null;
      launchMessageId?: string | null;
      materialIds?: string[];
      topic?: string;
      actionKey?: string;
    }) => {
      const key = input.actionKey ?? `studio:${input.type}`;
      setGeneratingType(input.type);
      setGeneratingKey(key);
      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/studio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            type: input.type,
            chatSessionId: input.chatSessionId ?? null,
            anchorMessageId: input.anchorMessageId ?? null,
            launchMessageId: input.launchMessageId ?? null,
            materialIds: input.materialIds,
            topic: input.topic,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          artifact?: TutorStudioArtifactDto;
          alreadyExisted?: boolean;
          error?: string;
        };
        if (!response.ok || !data.artifact) {
          throw new Error(data.error ?? "Gagal menyusun artefak Studio.");
        }
        upsertArtifact(data.artifact);
        setActiveArtifactId(data.artifact.id);
        toast.success(
          data.alreadyExisted
            ? "Membuka artefak Studio yang sudah tersimpan."
            : `"${data.artifact.title}" disimpan ke Studio.`
        );
        return data.artifact;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menyusun artefak Studio.");
        return null;
      } finally {
        setGeneratingType(null);
        setGeneratingKey(null);
      }
    },
    [courseId, upsertArtifact]
  );

  const saveMessageToNote = useCallback(
    async (input: {
      chatSessionId?: string | null;
      sourceMessageId: string;
      content: string;
      sources?: TutorStudioSource[];
    }) => {
      setSavingNoteMessageIds((prev) => {
        const next = new Set(prev);
        next.add(input.sourceMessageId);
        return next;
      });
      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/studio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_note",
            chatSessionId: input.chatSessionId ?? null,
            sourceMessageId: input.sourceMessageId,
            content: input.content,
            sources: input.sources ?? [],
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          artifact?: TutorStudioArtifactDto;
          alreadyExisted?: boolean;
          error?: string;
        };
        if (!response.ok || !data.artifact) {
          throw new Error(data.error ?? "Gagal menyimpan ke Studio.");
        }
        upsertArtifact(data.artifact);
        toast.success(
          data.alreadyExisted
            ? "Jawaban ini sudah tersimpan di Studio."
            : "Jawaban disimpan ke Studio."
        );
        return data.artifact;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menyimpan ke Studio.");
        return null;
      } finally {
        setSavingNoteMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(input.sourceMessageId);
          return next;
        });
      }
    },
    [courseId, upsertArtifact]
  );

  const handleRenameArtifact = useCallback(
    async (artifactId: string) => {
      const trimmedTitle = renameValue.trim();
      if (!trimmedTitle) {
        setRenamingArtifactId(null);
        return;
      }

      setSavingRename(true);
      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/studio/${artifactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          artifact?: TutorStudioArtifactDto;
          error?: string;
        };
        if (!response.ok || !data.artifact) {
          throw new Error(data.error ?? "Gagal mengubah judul.");
        }
        upsertArtifact(data.artifact);
        setRenamingArtifactId(null);
        toast.success("Judul artefak diperbarui.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengubah judul.");
      } finally {
        setSavingRename(false);
      }
    },
    [courseId, renameValue, upsertArtifact]
  );

  const handleDeleteArtifact = useCallback(
    async (artifactId: string) => {
      setDeletingArtifact(true);
      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/studio/${artifactId}`, {
          method: "DELETE",
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Gagal menghapus artefak.");
        }
        setArtifacts((prev) => prev.filter((item) => item.id !== artifactId));
        if (activeArtifactId === artifactId) {
          setActiveArtifactId(null);
        }
        toast.success("Artefak Studio dihapus.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menghapus artefak.");
      } finally {
        setDeletingArtifact(false);
        setDeleteArtifactId(null);
      }
    },
    [activeArtifactId, courseId]
  );

  const saveArtifactProgress = useCallback(
    async (artifactId: string, payload: UpdateTutorStudioProgressInput) => {
      try {
        const response = await fetch(
          `/api/courses/${courseId}/tutor/studio/${artifactId}/progress`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = (await response.json().catch(() => ({}))) as {
          artifact?: TutorStudioArtifactDto;
          error?: string;
        };
        if (!response.ok || !data.artifact) {
          throw new Error(data.error ?? "Gagal menyimpan progres.");
        }
        upsertArtifact(data.artifact);
        return data.artifact;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menyimpan progres.");
        return null;
      }
    },
    [courseId, upsertArtifact]
  );

  return {
    artifacts,
    filteredArtifacts,
    artifactsByMessage,
    loadingArtifacts,
    generatingType,
    generatingKey,
    savingNoteMessageIds,
    scope,
    setScope,
    typeFilter,
    setTypeFilter,
    activeArtifact,
    setActiveArtifactId,
    renamingArtifactId,
    setRenamingArtifactId,
    renameValue,
    setRenameValue,
    savingRename,
    deleteArtifactId,
    setDeleteArtifactId,
    deletingArtifact,
    loadArtifacts,
    openArtifactById,
    generateArtifact,
    saveMessageToNote,
    handleRenameArtifact,
    handleDeleteArtifact,
    saveArtifactProgress,
  };
}
