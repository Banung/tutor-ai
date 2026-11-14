import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  TutorChatSessionSummary,
  TutorMessage,
  TutorChatSession,
  TutorOverview,
} from "../tutor-chat-types";
import type { TutorPanelMode } from "../tutor-chat-input";

type UseTutorChatProps = {
  courseId: string;
  initialSessionId?: string;
  onNewChat?: () => void;
  onSessionChange?: (sessionId: string) => void;
  input: string;
  setInput: (value: string) => void;
  panelMode: TutorPanelMode;
};

export function useTutorChat({
  courseId,
  initialSessionId,
  onNewChat,
  onSessionChange,
  input,
  setInput,
  panelMode,
}: UseTutorChatProps) {
  const [overview, setOverview] = useState<TutorOverview | null>(null);
  const [chatSessions, setChatSessions] = useState<TutorChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<TutorChatSession | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const activeSessionRef = useRef<TutorChatSession | null>(null);
  const chatSessionsRef = useRef<TutorChatSessionSummary[]>([]);
  const readyMaterialsRef = useRef<TutorOverview["readyMaterials"]>([]);
  const loadingSessionRef = useRef(false);
  const lastAttemptRef = useRef<{ sessionId: string; question: string; mode: string; requestId: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadSessionRequestIdRef = useRef(0);

  useEffect(() => {
    activeSessionIdRef.current = activeSession?.id ?? null;
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [creatingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingContext, setSavingContext] = useState(false);

  const sendingRef = useRef(false);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // Rename state
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Delete state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  const readyMaterials = useMemo(() => overview?.readyMaterials ?? [], [overview?.readyMaterials]);
  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);

  useEffect(() => {
    readyMaterialsRef.current = readyMaterials;
  }, [readyMaterials]);

  useEffect(() => {
    loadingSessionRef.current = loadingSession;
  }, [loadingSession]);

  const selectedMaterialIds = useMemo(
    () => activeSession?.selectedMaterialIds ?? [],
    [activeSession]
  );
  const selectedMaterialSet = useMemo(
    () => new Set(selectedMaterialIds),
    [selectedMaterialIds]
  );

  const isNewChatDisabled =
    creatingChat || sending || activeSession === null || activeSession.messages.length === 0;

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (sendingRef.current) {
        toast("Harap tunggu Tutor AI membalas sebelum pindah chat");
        return;
      }

      if (activeSessionIdRef.current === sessionId && !loadingSessionRef.current) return;

      const requestId = loadSessionRequestIdRef.current + 1;
      loadSessionRequestIdRef.current = requestId;
      const previousSession = activeSessionRef.current;
      const sessionSummary = chatSessionsRef.current.find((session) => session.id === sessionId);

      onSessionChange?.(sessionId);
      setActiveSession({
        id: sessionId,
        courseId,
        selectedMaterialIds: readyMaterialsRef.current.map((material) => material.id),
        startedAt: sessionSummary?.startedAt ?? new Date().toISOString(),
        lastActiveAt: sessionSummary?.lastActiveAt ?? new Date().toISOString(),
        messages: [],
      });
      setLoadingSession(true);

      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/sessions/${sessionId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Gagal memuat chat");
        if (loadSessionRequestIdRef.current === requestId) {
          setActiveSession(data);
        }
      } catch (err) {
        if (loadSessionRequestIdRef.current === requestId) {
          setActiveSession(previousSession ?? null);
          toast.error(err instanceof Error ? err.message : "Gagal memuat chat");
          if (previousSession) {
            onSessionChange?.(previousSession.id);
          } else {
            onNewChat?.();
          }
        }
      } finally {
        if (loadSessionRequestIdRef.current === requestId) {
          setLoadingSession(false);
        }
      }
    },
    [courseId, onNewChat, onSessionChange]
  );

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/tutor`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal memuat Tutor AI");

      chatSessionsRef.current = data.chatSessions;
      readyMaterialsRef.current = data.readyMaterials;
      setOverview(data);
      setChatSessions(data.chatSessions);

      if (initialSessionId && activeSessionIdRef.current !== initialSessionId) {
        void loadSession(initialSessionId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat Tutor AI");
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [courseId, initialSessionId, loadSession]);

  async function createNewChat() {
    onNewChat?.();

    if (activeSession && activeSession.messages.length === 0) {
      return activeSession;
    }

    const dummyId = `new-${Date.now()}`;
    const newSession: TutorChatSession = {
      id: dummyId,
      courseId: courseId as string,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages: [],
      selectedMaterialIds: overview?.readyMaterials.map((m) => m.id) || [],
    };
    setActiveSession(newSession);

    setChatSessions((prev) => prev.filter((s) => !s.id.startsWith("new-")));

    return newSession;
  }

  async function updateContext(nextSelectedMaterialIds: string[]) {
    if (!activeSession) return;

    const previousSession = activeSession;
    setActiveSession({
      ...activeSession,
      selectedMaterialIds: nextSelectedMaterialIds,
    });

    if (activeSession.id.startsWith("new-")) {
      return;
    }

    setSavingContext(true);

    try {
      const response = await fetch(
        `/api/courses/${courseId}/tutor/sessions/${activeSession.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedMaterialIds: nextSelectedMaterialIds }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan konteks");
      setActiveSession(data);
    } catch (err) {
      setActiveSession(previousSession);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan konteks");
    } finally {
      setSavingContext(false);
    }
  }

  async function handleMaterialToggle(materialId: string, checked: boolean) {
    const nextIds = checked
      ? Array.from(new Set([...selectedMaterialIds, materialId]))
      : selectedMaterialIds.filter((id) => id !== materialId);

    await updateContext(nextIds);
  }

  async function handleMaterialToggleAll(checked: boolean) {
    const nextIds = checked ? readyMaterialsRef.current.map((m) => m.id) : [];
    await updateContext(nextIds);
  }

  async function handleRenameSession() {
    if (!renamingSessionId || savingRename) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingSessionId(null);
      return;
    }

    setSavingRename(true);
    try {
      const response = await fetch(
        `/api/courses/${courseId}/tutor/sessions/${renamingSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal mengubah nama");

      setChatSessions((sessions) =>
        sessions.map((s) =>
          s.id === renamingSessionId ? { ...s, title: trimmed } : s
        )
      );
      toast.success("Nama chat berhasil diubah");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah nama");
    } finally {
      setSavingRename(false);
      setRenamingSessionId(null);
    }
  }

  async function handleDeleteSession() {
    if (!deleteSessionId || deletingSession) return;

    setDeletingSession(true);
    try {
      const response = await fetch(
        `/api/courses/${courseId}/tutor/sessions/${deleteSessionId}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal menghapus chat");

      setChatSessions((sessions) => sessions.filter((s) => s.id !== deleteSessionId));

      if (activeSession?.id === deleteSessionId) {
        const remaining = chatSessions.filter((s) => s.id !== deleteSessionId);
        if (remaining.length > 0) {
          await loadSession(remaining[0].id);
        } else {
          await createNewChat();
        }
      }

      toast.success("Chat berhasil dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus chat");
    } finally {
      setDeletingSession(false);
      setDeleteSessionId(null);
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;
    if (loadingSessionRef.current) {
      toast("Harap tunggu chat selesai dimuat sebelum mengirim pesan");
      return;
    }

    let session = activeSession;
    if (!session) {
      session = await createNewChat();
      if (!session) return;
    }

    setInput("");
    setSending(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const pendingMessage: TutorMessage = {
      id: `pending-${Date.now()}`,
      senderType: "user",
      content: question,
      ragSources: null,
      responseTimeMs: null,
      createdAt: new Date().toISOString(),
    };

    const streamingAiMessage: TutorMessage = {
      id: `streaming-${Date.now()}`,
      senderType: "ai",
      content: "",
      ragSources: null,
      responseTimeMs: null,
      createdAt: new Date().toISOString(),
    };

    setActiveSession({
      ...session,
      messages: [...session.messages, pendingMessage, streamingAiMessage],
    });

    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${pendingMessage.id}`);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });

    let realSessionId = session.id;
    const isNewSession = session.id.startsWith("new-");

    if (isNewSession) {
      try {
        const response = await fetch(`/api/courses/${courseId}/tutor/sessions`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Gagal membuat sesi baru");
        
        realSessionId = data.id;
        onSessionChange?.(realSessionId);
        
        if (session.selectedMaterialIds.length > 0) {
          await fetch(`/api/courses/${courseId}/tutor/sessions/${realSessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedMaterialIds: session.selectedMaterialIds }),
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal membuat sesi baru");
        setInput(question);
        setSending(false);
        setActiveSession(session);
        return;
      }
    }

    try {
      let retryOfRunId: string | undefined;
      const previous = lastAttemptRef.current;
      if (previous?.sessionId === realSessionId && previous.question === question && previous.mode === panelMode) {
        const statusResponse = await fetch(`/api/courses/${courseId}/tutor/sessions/${realSessionId}/runs/${previous.requestId}`, { signal: abortController.signal });
        if (statusResponse.ok) {
          const run = await statusResponse.json();
          if (run.status === "running" || run.status === "completed") {
            throw new Error("Request sebelumnya sudah diterima. Muat ulang riwayat untuk melihat hasilnya.");
          }
          retryOfRunId = run.id;
        } else if (statusResponse.status !== 404) {
          throw new Error("Status percobaan sebelumnya belum dapat diperiksa. Coba lagi nanti.");
        }
      }
      const requestId = crypto.randomUUID();
      lastAttemptRef.current = { sessionId: realSessionId, question, mode: panelMode, requestId };
      const response = await fetch(
        `/api/courses/${courseId}/tutor/sessions/${realSessionId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: question, responseMode: panelMode, requestId, retryOfRunId }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Tutor AI gagal menjawab");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream tidak tersedia");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let ragSources: unknown = null;
      let responseTimeMs: number | null = null;
      let streamDone = false;
      let eventType = "";

      const finalizeStream = (userMessageId?: string, answerMessageId?: string) => {
        streamDone = true;
        lastAttemptRef.current = null;
        setActiveSession((prev) => {
          if (!prev) return prev;
          const sessionId = isNewSession ? realSessionId : prev.id;
          const messages = prev.messages.map((msg) => {
            if (msg.id === pendingMessage.id) {
              return { ...msg, id: userMessageId ?? `user-${Date.now()}` };
            }
            if (msg.id === streamingAiMessage.id) {
              return {
                ...msg,
                id: answerMessageId ?? `ai-${Date.now()}`,
                content: accumulatedText,
                ragSources,
                responseTimeMs,
              };
            }
            return msg;
          });
          return { ...prev, id: sessionId, messages };
        });
        setChatSessions((sessions) => {
          const sid = isNewSession ? realSessionId : session.id;
          const summary: TutorChatSessionSummary = {
            id: sid,
            title: question.slice(0, 72),
            messageCount: (session.messages.length || 0) + 2,
            startedAt: session.startedAt,
            lastActiveAt: new Date().toISOString(),
          };
          const others = sessions.filter(
            (item) => item.id !== sid && item.id !== session.id
          );
          return [summary, ...others];
        });
      };

      const handleStreamEvent = (type: string, rawData: string) => {
        let data: {
          text?: string;
          ragSources?: unknown;
          responseTimeMs?: number | null;
          error?: string;
          userMessageId?: string;
          answerMessageId?: string;
        };

        try {
          data = JSON.parse(rawData);
        } catch {
          throw new Error("Respons Tutor AI tidak valid");
        }

        if (type === "text") {
          accumulatedText += data.text ?? "";
          setActiveSession((prev) => {
            if (!prev) return prev;
            const messages = [...prev.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.id === streamingAiMessage.id) {
              messages[messages.length - 1] = {
                ...lastMsg,
                content: accumulatedText,
              };
            }
            return { ...prev, messages };
          });
          return;
        }

        if (type === "metadata") {
          ragSources = data.ragSources;
          responseTimeMs = data.responseTimeMs ?? null;
          return;
        }

        if (type === "done") {
          finalizeStream(data.userMessageId, data.answerMessageId);
          return;
        }

        if (type === "error") {
          throw new Error(data.error ?? "Tutor AI gagal menjawab");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            handleStreamEvent(eventType, line.slice(6));
            eventType = "";
          }
        }
      }

      if (!streamDone) throw new Error("Koneksi terputus sebelum jawaban selesai. Muat ulang riwayat sebelum mencoba lagi.");
    } catch (err) {
      const isAborted = err instanceof DOMException && err.name === "AbortError";
      setActiveSession((prev) => {
        if (!prev) return prev;
        const messages = prev.messages.filter(
          (msg) => msg.id !== streamingAiMessage.id && msg.id !== pendingMessage.id
        );
        return { ...prev, id: isNewSession ? realSessionId : prev.id, messages };
      });
      if (!isAborted) {
        setInput(question);
        toast.error(err instanceof Error ? err.message : "Tutor AI gagal menjawab");
      }
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  }

  return {
    overview,
    chatSessions,
    activeSession,
    loadingOverview,
    loadingSession,
    creatingChat,
    sending,
    savingContext,
    
    renamingSessionId,
    setRenamingSessionId,
    renameValue,
    setRenameValue,
    savingRename,
    
    deleteSessionId,
    setDeleteSessionId,
    deletingSession,

    readyMaterials,
    selectedMaterialSet,
    isNewChatDisabled,

    loadOverview,
    loadSession,
    createNewChat,
    handleMaterialToggle,
    handleMaterialToggleAll,
    handleRenameSession,
    handleDeleteSession,
    handleStop,
    handleSend,
  };
}
