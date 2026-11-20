"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FolderKanban,
  House,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { TutorChatSessionSummary, TutorChatSession } from "./tutor-chat-types";

export function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export type TutorChatSidebarProps = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  chatSessions: TutorChatSessionSummary[];
  activeSession: TutorChatSession | null;
  creatingChat: boolean;
  isNewChatDisabled: boolean;
  loadingSessions?: boolean;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  createNewChat: () => Promise<TutorChatSession | undefined>;
  loadSession: (sessionId: string) => Promise<void>;
  renamingSessionId: string | null;
  setRenamingSessionId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  savingRename: boolean;
  handleRenameSession: () => Promise<void>;
  setDeleteSessionId: (id: string | null) => void;
  backHref: string;
  courseId?: string;
  courseBaseHref?: string;
  currentCourseTitle?: string;
  currentUserName?: string | null;
};

type StudentCourse = { id: string; title: string };

export function TutorChatSidebar({
  sidebarOpen,
  setSidebarOpen,
  chatSessions,
  activeSession,
  creatingChat,
  isNewChatDisabled,
  loadingSessions = false,
  setSearchOpen,
  setSearchQuery,
  createNewChat,
  loadSession,
  renamingSessionId,
  setRenamingSessionId,
  renameValue,
  setRenameValue,
  savingRename,
  handleRenameSession,
  setDeleteSessionId,
  backHref,
  courseId,
  courseBaseHref,
  currentCourseTitle,
  currentUserName,
}: TutorChatSidebarProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    if (!courseBaseHref) return;

    let cancelled = false;
    setLoadingCourses(true);
    fetch("/api/mahasiswa/courses")
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat mata kuliah");
        return response.json();
      })
      .then((data: StudentCourse[]) => {
        if (!cancelled && Array.isArray(data)) setCourses(data);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseBaseHref]);

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs transition-opacity duration-300 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r bg-muted/30 transition-all duration-300 z-50",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:bg-background",
          sidebarOpen ? "w-72" : "w-16 max-md:-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn("flex h-14 shrink-0 items-center", sidebarOpen ? "justify-between px-3" : "justify-center px-0")}>
          {sidebarOpen && <span className="truncate text-lg font-bold">Tutor AI Chat</span>}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Toggle sidebar"
              >
                <SidebarToggleIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{sidebarOpen ? "Tutup panel" : "Buka panel"}</TooltipContent>
          </Tooltip>
        </div>

        {courseBaseHref && (
          <div className="mt-3 px-3">
            {sidebarOpen ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-h-14 w-full items-center gap-3 rounded-lg border bg-background px-3 text-left transition-colors hover:bg-muted">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                      <FolderKanban className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mata kuliah</span>
                      <span className="block truncate text-sm font-medium">{currentCourseTitle ?? "Pilih mata kuliah"}</span>
                    </span>
                    {loadingCourses ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mata kuliah</div>
                  {courses.map((course) => (
                    <DropdownMenuItem
                      key={course.id}
                      onClick={() => {
                        if (course.id !== courseId) router.push(`${courseBaseHref}/${course.id}/tutor`);
                      }}
                      className="min-w-0"
                    >
                      <FolderKanban className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{course.title}</span>
                      {course.id === courseId && <Check className="size-4 text-brand" />}
                    </DropdownMenuItem>
                  ))}
                  {!loadingCourses && courses.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Tidak ada mata kuliah tersedia.</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-11 w-full items-center justify-center rounded-lg text-brand transition-colors hover:bg-muted"
                    aria-label={`Mata kuliah: ${currentCourseTitle ?? "pilih mata kuliah"}`}
                  >
                    <FolderKanban className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{currentCourseTitle ?? "Mata kuliah"}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Menu Items — New Chat & Search */}
        <div className="mt-2 flex flex-col gap-2 px-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={createNewChat}
                disabled={isNewChatDisabled}
                className={cn(
                  "flex h-11 w-full items-center rounded-lg text-sm font-medium transition-colors",
                  sidebarOpen ? "gap-4 px-4" : "justify-center px-0",
                  isNewChatDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted hover:text-foreground"
                )}
              >
                {creatingChat ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <Plus className="size-4 shrink-0" />
                )}
                {sidebarOpen && <span className="truncate">New chat</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" hidden={sidebarOpen}>
              New chat
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex h-11 w-full items-center rounded-lg text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                  sidebarOpen ? "gap-4 px-4" : "justify-center px-0"
                )}
              >
                <Search className="size-4 shrink-0" />
                {sidebarOpen && <span className="truncate">Search</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" hidden={sidebarOpen}>
              Search
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Chats Label */}
        {sidebarOpen ? (
          <div className="mt-6 px-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chats
            </span>
          </div>
        ) : (
          <div className="mx-4 mb-2 mt-6 border-t" />
        )}

        {/* Session List */}
        <div className="mt-2 flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex flex-col gap-1">
            {loadingSessions ? (
              Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex h-11 items-center rounded-lg",
                    sidebarOpen ? "px-4" : "justify-center px-0"
                  )}
                >
                  {sidebarOpen ? (
                    <Skeleton
                      className={cn(
                        "h-4",
                        index % 3 === 0 ? "w-44" : index % 3 === 1 ? "w-36" : "w-52"
                      )}
                    />
                  ) : (
                    <Skeleton className="size-4 rounded-full" />
                  )}
                </div>
              ))
            ) : chatSessions.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                {sidebarOpen ? "Belum ada chat." : "-"}
              </div>
            ) : (
              chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group/session relative flex items-center rounded-lg transition-colors",
                    activeSession?.id === session.id
                      ? "bg-brand font-medium text-black"
                      : "hover:bg-muted hover:text-foreground",
                    !sidebarOpen && "h-11 justify-center"
                  )}
                >
                  {renamingSessionId === session.id && sidebarOpen ? (
                    <div className="flex w-full items-center gap-1.5 px-3 py-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRenameSession();
                          if (e.key === "Escape") setRenamingSessionId(null);
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                        disabled={savingRename}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => void handleRenameSession()}
                        disabled={savingRename}
                      >
                        {savingRename ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setRenamingSessionId(null)}
                        disabled={savingRename}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => loadSession(session.id)}
                            className={cn(
                              "flex min-w-0 flex-1 items-center",
                              sidebarOpen ? "py-2.5 pl-4 pr-10 text-left" : "h-full w-full justify-center"
                            )}
                          >
                            {!sidebarOpen ? (
                              <MessageCircle className="size-4 shrink-0" />
                            ) : (
                              <span className="truncate text-sm">{session.title}</span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" hidden={sidebarOpen}>
                          {session.title}
                        </TooltipContent>
                      </Tooltip>

                      {/* More Actions — visible on hover */}
                      {sidebarOpen && (
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/session:opacity-100 data-[state=open]:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className={cn(
                                  "transition-colors",
                                  activeSession?.id === session.id
                                    ? "text-black/60 hover:bg-black/10 hover:text-black"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRenamingSessionId(session.id);
                                    setRenameValue(session.title);
                                  }}
                                >
                                  <Pencil className="mr-2 size-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteSessionId(session.id)}>
                                  <Trash2 className="mr-2 size-4" /> Hapus
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer — Back button */}
        <div className="shrink-0 px-3 pb-3 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push(backHref)}
                className={cn(
                  "flex h-9 w-full items-center rounded-lg text-xs font-medium transition-colors",
                  sidebarOpen
                    ? "gap-2.5 border border-brand/30 bg-brand/10 px-3 text-foreground hover:bg-brand/20"
                    : "justify-center px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <House className="size-4 shrink-0" />
                {sidebarOpen && <span className="truncate">Kembali ke Dashboard</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" hidden={sidebarOpen}>
              Kembali ke Dashboard
            </TooltipContent>
          </Tooltip>
          {currentUserName && (
            <div className="flex min-w-0 items-center gap-2.5 px-1.5 pt-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-black">
                {currentUserName.trim().charAt(0).toUpperCase()}
              </span>
              {sidebarOpen && (
                <span className="truncate text-xs font-medium">{currentUserName}</span>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
