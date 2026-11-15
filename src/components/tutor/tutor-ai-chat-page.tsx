"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MessageCircle,
  Search,
  Settings2,
  UserPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { TutorChatSidebar, SidebarToggleIcon } from "./tutor-chat-sidebar";
import { TutorChatMessages } from "./tutor-chat-messages";
import { TutorChatInput, type TutorPanelMode } from "./tutor-chat-input";
import { TutorChatContextDialog } from "./tutor-chat-context-dialog";
import { TutorAvatarPanel } from "./tutor-avatar-panel";
import { TutorAvatarCustomizationDialog } from "./tutor-avatar-customization-dialog";
import {
  DEFAULT_TUTOR_AVATAR_CUSTOMIZATION,
  TUTOR_AVATAR_CUSTOMIZATION_STORAGE_KEY,
  isTutorAvatarCustomization,
  type TutorAvatarCustomization,
} from "./tutor-avatar-customization";

import type { TutorAiChatPageProps } from "./tutor-chat-types";
import { useTutorChat } from "./hooks/use-tutor-chat";
import { useTutorSpeech } from "./hooks/use-tutor-speech";

const CHAT_INPUT_MIN_HEIGHT = 44;
const CHAT_LANDING_MESSAGES = [
  "Siap belajar hari ini, {name}?",
  "Hai, {name}. Mau mulai dari mana hari ini?",
  "Halo, {name}. Ada yang ingin kamu pahami?",
  "Selamat datang, {name}. Kita belajar bareng yuk.",
  "Apa kabar, {name}? Siap bahas materi hari ini?",
  "Yuk mulai pelan-pelan, {name}.",
  "{name}, ada materi yang mau kita bahas?",
  "Hai, {name}. Aku bantu pahami materinya ya.",
  "Siap lanjut belajar, {name}?",
  "Kita bahas bareng-bareng, {name}.",
  "{name}, mau kupandu memahami materi ini?",
  "Halo, {name}. Yuk pahami materinya bersama.",
  "Tenang, {name}. Kita bahas sampai jelas.",
  "Ada yang bikin bingung, {name}?",
  "Yuk, {name}. Mulai dari bagian yang kamu mau.",
  "Aku siap bantu kamu belajar, {name}.",
  "Mau bahas materi hari ini, {name}?",
  "Hai, {name}. Kita mulai dari yang paling penting.",
  "{name}, siap memahami materi ini lebih dalam?",
  "Yuk lanjutkan belajarmu, {name}.",
  "Ada bagian yang ingin dibahas dulu, {name}?",
  "Santai saja, {name}. Kita pelajari bersama.",
  "Halo, {name}. Aku bantu jelaskan dengan mudah.",
  "Siap memperjelas materi hari ini, {name}?",
  "{name}, mau kita uraikan materinya pelan-pelan?",
  "Yuk pahami konsepnya bersama, {name}.",
  "Hai, {name}. Ada yang perlu dijelaskan lagi?",
  "Aku temani belajarmu hari ini, {name}.",
  "Kita mulai dari pertanyaanmu, {name}.",
  "{name}, siap belajar dengan lebih mudah?",
  "Mau kupersingkat penjelasannya, {name}?",
  "Yuk bahas materi yang sedang kamu pelajari.",
  "Halo, {name}. Apa yang mau kita pahami dulu?",
  "Tenang, kita cari jawabannya bareng, {name}.",
  "Siap menggali materi hari ini, {name}?",
  "Hai, {name}. Mau lanjut dari materi terakhir?",
  "{name}, aku bantu sederhanakan materinya.",
  "Yuk mulai belajar dengan santai, {name}.",
  "Ada materi yang ingin kamu dalami, {name}?",
  "Kita pahami satu per satu, {name}.",
];

function getFirstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "Mahasiswa";
}

function getLandingMessage(name: string, index: number) {
  return CHAT_LANDING_MESSAGES[index].replace("{name}", name);
}

export function TutorAiChatPage({
  courseId,
  backHref,
  tutorHref = `/courses/${courseId}/tutor`,
  courseBaseHref,
  initialSessionId,
}: TutorAiChatPageProps) {
  const router = useRouter();
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [input, setInput] = useState("");
  const [avatarCustomization, setAvatarCustomization] =
    useState<TutorAvatarCustomization>(DEFAULT_TUTOR_AVATAR_CUSTOMIZATION);
  const [avatarCustomizationHydrated, setAvatarCustomizationHydrated] =
    useState(false);
  const [avatarCustomizationOpen, setAvatarCustomizationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelMode, setPanelMode] = useState<TutorPanelMode>("chat");
  const [landingMessageIndex] = useState(() =>
    Math.floor(Math.random() * CHAT_LANDING_MESSAGES.length)
  );

  const updateTutorUrl = useCallback((nextHref: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === nextHref) return;

    window.history.pushState(null, "", nextHref);
  }, []);

  const handleNewChatRoute = useCallback(() => {
    updateTutorUrl(tutorHref);
  }, [tutorHref, updateTutorUrl]);

  const handleSessionRouteChange = useCallback(
    (sessionId: string) => {
      updateTutorUrl(`${tutorHref}/${sessionId}`);
    },
    [tutorHref, updateTutorUrl]
  );

  const {
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
  } = useTutorChat({
    courseId,
    initialSessionId,
    onNewChat: handleNewChatRoute,
    onSessionChange: handleSessionRouteChange,
    input,
    setInput,
    panelMode,
  });

  const {
    recording,
    transcribing,
    recordingLevels,
    handleStartRecording,
    handleCancelRecording,
    handleConfirmRecording,
  } = useTutorSpeech({ input, setInput, sending, courseId });

  const userFirstName = getFirstName(overview?.user.name);
  const chatLandingMessage = useMemo(
    () => getLandingMessage(userFirstName, landingMessageIndex),
    [landingMessageIndex, userFirstName]
  );
  const isChatLanding =
    panelMode === "chat" &&
    !loadingOverview &&
    !loadingSession &&
    !sending &&
    (!activeSession || activeSession.messages.length === 0);
  const activeSessionId = activeSession?.id;

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    try {
      const storedCustomization = window.localStorage.getItem(
        TUTOR_AVATAR_CUSTOMIZATION_STORAGE_KEY
      );
      if (storedCustomization) {
        const parsedCustomization: unknown = JSON.parse(storedCustomization);
        if (isTutorAvatarCustomization(parsedCustomization)) {
          setAvatarCustomization(parsedCustomization);
        }
      }
    } catch {
      // Keep the default customization if browser storage is unavailable.
    } finally {
      setAvatarCustomizationHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!avatarCustomizationHydrated) return;

    try {
      window.localStorage.setItem(
        TUTOR_AVATAR_CUSTOMIZATION_STORAGE_KEY,
        JSON.stringify(avatarCustomization)
      );
    } catch {
      // Customization still works for the current session without persistence.
    }
  }, [avatarCustomization, avatarCustomizationHydrated]);

  // Search-filtered sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return chatSessions;
    const q = searchQuery.toLowerCase();
    return chatSessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [chatSessions, searchQuery]);

  // Helper to scroll to the latest messages
  const scrollToMessages = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  // Scroll to latest messages when session loads
  const previousLoadingRef = useRef(loadingSession);
  useEffect(() => {
    if (previousLoadingRef.current && !loadingSession && activeSessionId) {
      scrollToMessages("auto");

      const timer1 = setTimeout(() => scrollToMessages("auto"), 50);
      const timer2 = setTimeout(() => scrollToMessages("auto"), 150);
      const timer3 = setTimeout(() => scrollToMessages("auto"), 400);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
    previousLoadingRef.current = loadingSession;
  }, [activeSessionId, loadingSession, scrollToMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (!input) {
        textarea.style.height = `${CHAT_INPUT_MIN_HEIGHT}px`;
        return;
      }

      textarea.style.height = "auto";
      const measuredHeight = textarea.scrollHeight;
      const nextHeight =
        measuredHeight <= CHAT_INPUT_MIN_HEIGHT + 8
          ? CHAT_INPUT_MIN_HEIGHT
          : Math.min(measuredHeight, 160);

      textarea.style.height = `${nextHeight}px`;
    }
  }, [input]);


  // ==================== ERROR STATE ====================
  if (!loadingOverview && !overview) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 bg-background p-8 text-center text-muted-foreground">
        <MessageCircle className="size-12 text-muted-foreground/50" strokeWidth={1.5} />
        <p>Course tidak ditemukan atau Anda belum enroll.</p>
        <Button variant="outline" onClick={() => router.push(backHref)}>
          Kembali ke Course
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* ==================== SIDEBAR ==================== */}
      <TutorChatSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        chatSessions={chatSessions}
        activeSession={activeSession}
        creatingChat={creatingChat}
        isNewChatDisabled={loadingOverview || isNewChatDisabled}
        loadingSessions={loadingOverview}
        setSearchOpen={setSearchOpen}
        setSearchQuery={setSearchQuery}
        createNewChat={createNewChat}
        loadSession={loadSession}
        renamingSessionId={renamingSessionId}
        setRenamingSessionId={setRenamingSessionId}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        savingRename={savingRename}
        handleRenameSession={handleRenameSession}
        setDeleteSessionId={setDeleteSessionId}
        backHref={backHref}
        courseId={courseId}
        courseBaseHref={courseBaseHref}
        currentCourseTitle={overview?.course.title}
      />

      {/* ==================== MAIN CHAT AREA ==================== */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 px-5">
          {!sidebarOpen && (
            <div className="md:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSidebarOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Open sidebar"
                  >
                    <SidebarToggleIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Buka panel</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {overview ? (
              <p className="truncate text-sm font-medium text-muted-foreground">
                {overview.course.title}
              </p>
            ) : (
              <Skeleton className="h-4 w-56 max-w-full" />
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setAvatarCustomizationOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Personalisasi Avatar"
              >
                <UserPen className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Personalisasi Avatar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={async () => {
                  if (!activeSession) {
                    const session = await createNewChat();
                    if (!session) return;
                  }
                  setSettingsOpen(true);
                }}
                disabled={loadingOverview || creatingChat}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Context Materi"
              >
                <Settings2 className="size-5" />
                {savingContext && <Loader2 className="absolute size-5 animate-spin" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Context Materi ({readyMaterials.length} PDF)
            </TooltipContent>
          </Tooltip>
        </header>

        {/* Messages area */}
        {loadingOverview ? (
          <TutorChatMessages
            courseId={courseId}
            canGiveFeedback={overview?.user.role === "mahasiswa"}
            activeSession={null}
            loadingSession
            sending={false}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
          />
        ) : isChatLanding ? (
          <div className="relative flex-1 px-5">
            <div className="absolute left-5 right-5 top-[43%] flex -translate-y-1/2 flex-col items-center gap-10 text-center">
              <p className="max-w-2xl text-balance text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                {chatLandingMessage}
              </p>
              <TutorChatInput
                input={input}
                setInput={setInput}
                panelMode={panelMode}
                setPanelMode={setPanelMode}
                placement="inline"
                sending={sending}
                recording={recording}
                transcribing={transcribing}
                recordingLevels={recordingLevels}
                handleSend={handleSend}
                handleStop={handleStop}
                handleStartRecording={handleStartRecording}
                handleCancelRecording={handleCancelRecording}
                handleConfirmRecording={handleConfirmRecording}
                textareaRef={textareaRef}
              />
            </div>
          </div>
        ) : panelMode === "chat" ? (
          <TutorChatMessages
            courseId={courseId}
            canGiveFeedback={overview?.user.role === "mahasiswa"}
            activeSession={activeSession}
            loadingSession={loadingSession}
            sending={sending}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <TutorAvatarPanel
            activeSession={activeSession}
            customization={avatarCustomization}
            courseId={courseId}
            loadingSession={loadingSession}
            sending={sending}
            recording={recording}
            transcribing={transcribing}
          />
        )}

        {/* ==================== FLOATING INPUT AREA ==================== */}
        {!loadingOverview && !isChatLanding && (
          <TutorChatInput
            input={input}
            setInput={setInput}
            panelMode={panelMode}
            setPanelMode={setPanelMode}
            sending={sending}
            recording={recording}
            transcribing={transcribing}
            recordingLevels={recordingLevels}
            handleSend={handleSend}
            handleStop={handleStop}
            handleStartRecording={handleStartRecording}
            handleCancelRecording={handleCancelRecording}
            handleConfirmRecording={handleConfirmRecording}
            textareaRef={textareaRef}
          />
        )}
      </main>

      {/* ==================== SEARCH DIALOG ==================== */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cari Chat</DialogTitle>
            <DialogDescription>Cari sesi chat berdasarkan judul atau isi pesan pertama.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari chat..."
                autoFocus
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
              {filteredSessions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery.trim() ? "Tidak ditemukan." : "Belum ada chat."}
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      void loadSession(session.id);
                      setSearchOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                      activeSession?.id === session.id && "bg-muted font-medium"
                    )}
                  >
                    <MessageCircle className="mr-3 size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{session.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TutorAvatarCustomizationDialog
        customization={avatarCustomization}
        onCustomizationChange={setAvatarCustomization}
        onOpenChange={setAvatarCustomizationOpen}
        open={avatarCustomizationOpen}
      />

      {/* ==================== CONTEXT MATERI DIALOG ==================== */}
      <TutorChatContextDialog
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        readyMaterials={readyMaterials}
        selectedMaterialSet={selectedMaterialSet}
        activeSession={activeSession}
        savingContext={savingContext}
        handleMaterialToggle={handleMaterialToggle}
        handleMaterialToggleAll={handleMaterialToggleAll}
      />

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <AlertDialog
        open={!!deleteSessionId}
        onOpenChange={(open) => !open && setDeleteSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus chat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Chat beserta semua pesannya akan dihapus secara permanen. Tindakan ini tidak
              bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSession}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSession();
              }}
              disabled={deletingSession}
            >
              {deletingSession ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
