"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Plus, GraduationCap, Users, KeyRound, Copy, CalendarDays, Check,
  FileText, Upload, Loader2, Trash2, Pencil,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SessionCard } from "./session-card";
import { StudentListDialog } from "./student-list-dialog";
import { CourseKeyConfirmDialog } from "./course-key-confirm-dialog";
import { StatusToggleButton } from "./status-toggle-button";
import { CourseHeroCard } from "@/components/courses/course-hero-card";
import { CourseInvitationButton } from "@/components/courses/course-invitation-button";
import type { CourseDetail, SessionItem } from "./types";

type ContentType = "file" | "link" | "text";

type NewMaterial = {
  id: string;
  type: ContentType;
  title: string;
  description: string;
  url: string;
  content: string;
  file: File | null;
};

type CourseAction =
  | { type: "toggle"; nextActive: boolean }
  | { type: "delete" }
  | null;

const emptyMaterial = (): NewMaterial => ({
  id: crypto.randomUUID(),
  type: "file",
  title: "",
  description: "",
  url: "",
  content: "",
  file: null,
});

export default function DosenCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: "", description: "" });
  const [newMaterials, setNewMaterials] = useState<NewMaterial[]>([]);
  const [courseAction, setCourseAction] = useState<CourseAction>(null);
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [courseSubmitting, setCourseSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchCourse = useCallback(() => {
    setLoading(true);
    fetch(`/api/dosen/courses/${courseId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Not found");
        return response.json();
      })
      .then(setCourse)
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  const fetchSessions = useCallback(() => {
    setLoadingSessions(true);
    fetch(`/api/dosen/courses/${courseId}/sessions`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data);
          setSessionsLoaded(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingSessions(false));
  }, [courseId]);

  const refreshCourseContent = useCallback(() => {
    fetchCourse();
    fetchSessions();
  }, [fetchCourse, fetchSessions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCourse();
      fetchSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchCourse, fetchSessions]);

  function resetDialog() {
    setSessionForm({ title: "", description: "" });
    setNewMaterials([]);
  }

  function openCourseEditDialog() {
    if (!course) return;

    setCourseForm({
      title: course.title,
      description: course.description ?? "",
    });
    setEditCourseOpen(true);
  }

  function updateMaterial(id: string, updates: Partial<NewMaterial>) {
    setNewMaterials((materials) =>
      materials.map((material) => material.id === id ? { ...material, ...updates } : material)
    );
  }

  async function uploadMaterial(sessionId: string, material: NewMaterial) {
    if (material.type === "file" && material.file) {
      const formData = new FormData();
      formData.append("file", material.file);
      formData.append("title", material.title.trim());
      if (material.description.trim()) formData.append("description", material.description.trim());

      return fetch(`/api/dosen/courses/${courseId}/sessions/${sessionId}/materials`, {
        method: "POST",
        body: formData,
      });
    }

    const body: Record<string, string> = {
      title: material.title.trim(),
      type: material.type,
    };

    if (material.type === "link") body.url = material.url.trim();
    if (material.type === "text") body.content = material.content.trim();
    if (material.description.trim()) body.description = material.description.trim();

    return fetch(`/api/dosen/courses/${courseId}/sessions/${sessionId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function handleUpdateCourseDetails() {
    if (!course) return;
    if (!courseForm.title.trim()) {
      toast.error("Judul course wajib diisi");
      return;
    }

    setCourseSubmitting(true);
    try {
      const response = await fetch(`/api/dosen/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentKey: course.enrollmentKey,
          title: courseForm.title.trim(),
          description: courseForm.description.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal memperbarui course");

      setCourse(data);
      setEditCourseOpen(false);
      toast.success("Detail course berhasil diperbarui");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui course");
    } finally {
      setCourseSubmitting(false);
    }
  }

  async function handleCreateSession() {
    if (!sessionForm.title.trim()) {
      toast.error("Judul sesi wajib diisi");
      return;
    }

    for (const material of newMaterials) {
      if (!material.title.trim()) {
        toast.error("Semua materi harus memiliki judul");
        return;
      }
      if (material.type === "file" && !material.file) {
        toast.error(`Pilih file untuk materi: ${material.title}`);
        return;
      }
      if (material.type === "link" && !material.url.trim()) {
        toast.error(`Masukkan URL untuk materi: ${material.title}`);
        return;
      }
      if (material.type === "text" && !material.content.trim()) {
        toast.error(`Masukkan teks untuk materi: ${material.title}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/dosen/courses/${courseId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionForm.title.trim(),
          description: sessionForm.description.trim() || null,
        }),
      });
      const sessionData = await response.json();
      if (!response.ok) throw new Error(sessionData.error?.toString() || "Gagal membuat sesi");

      for (const material of newMaterials) {
        const uploadResponse = await uploadMaterial(sessionData.id, material);
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error ?? `Gagal menyimpan materi ${material.title}`);
        }
      }

      toast.success("Sesi beserta materi berhasil dibuat");
      setDialogOpen(false);
      resetDialog();
      refreshCourseContent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCourseAction(submittedKey: string) {
    if (!courseAction) return;

    if (courseAction.type === "toggle") {
      const response = await fetch(`/api/dosen/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentKey: submittedKey,
          isActive: courseAction.nextActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal mengubah status course");

      setCourse(data);
      toast.success(courseAction.nextActive ? "Course diaktifkan" : "Course dinonaktifkan");
      return;
    }

    const response = await fetch(`/api/dosen/courses/${courseId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentKey: submittedKey }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Gagal menghapus course");

    toast.success("Course berhasil dihapus");
    router.push("/dosen/courses");
  }

  function getCourseActionCopy() {
    if (!courseAction || !course) {
      return { title: "", description: "", confirmLabel: "" };
    }

    if (courseAction.type === "delete") {
      return {
        title: "Hapus course?",
        description: `Course "${course.title}" beserta sesi, materi, dan data terkait akan dihapus permanen.`,
        confirmLabel: "Hapus Course",
      };
    }

    return {
      title: courseAction.nextActive ? "Aktifkan course?" : "Nonaktifkan course?",
      description: courseAction.nextActive
        ? `Course "${course.title}" akan kembali terlihat sebagai course aktif.`
        : `Course "${course.title}" akan dinonaktifkan dari akses mahasiswa.`,
      confirmLabel: courseAction.nextActive ? "Aktifkan" : "Nonaktifkan",
    };
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <p>Course tidak ditemukan atau Anda tidak memiliki akses.</p>
        <Button variant="outline" onClick={() => router.push("/dosen/courses")}>Kembali</Button>
      </div>
    );
  }

  const activeSessions = sessions.filter((session) => session.isActive);
  const activeMaterialCount = activeSessions.reduce(
    (count, session) => count + session.materials.filter((material) => material.isActive).length,
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dosen/courses")} className="self-start -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft data-icon="inline-start" />
        Kembali ke Courses
      </Button>

      <div className="flex flex-col gap-6">
        <CourseHeroCard
          title={course.title}
          description={course.description}
          coverImage={course.coverImage}
          actions={
            <>
              <StatusToggleButton
                active={course.isActive}
                onClick={() => setCourseAction({ type: "toggle", nextActive: !course.isActive })}
              />
              <Button
                className="bg-brand text-black shadow-sm hover:bg-brand/90"
                onClick={openCourseEditDialog}
              >
                <Pencil data-icon="inline-start" />
                Edit Detail
              </Button>
              <Button
                className="bg-brand text-black shadow-sm hover:bg-brand/90"
                onClick={() => setShowStudents(true)}
              >
                <Users data-icon="inline-start" />
                Daftar Mahasiswa
              </Button>
              <Button
                variant="ghost"
                className="bg-transparent text-destructive shadow-none hover:bg-transparent hover:text-destructive hover:font-semibold"
                onClick={() => setCourseAction({ type: "delete" })}
              >
                <Trash2 data-icon="inline-start" />
                Hapus
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Enrollment Key</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => { navigator.clipboard.writeText(course.enrollmentKey); toast.success("Disalin"); }}
                className="inline-flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-bold">
                  <KeyRound className="size-4 text-brand" />
                  {course.enrollmentKey}
                </span>
                <Copy className="size-3.5 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Undangan</CardDescription>
            </CardHeader>
            <CardContent><CourseInvitationButton courseId={course.id} /></CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Mahasiswa Terdaftar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <GraduationCap className="size-5 text-emerald-600" />
                </div>
                <span className="text-3xl font-bold">{course._count.enrollments}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Dosen Pengampu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Users className="size-5 text-blue-600" />
                </div>
                <span className="text-3xl font-bold">{course.instructors.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-medium">Penyelarasan Tutor <span className="ml-1 text-xs font-normal text-muted-foreground">Opsional</span></p>
              <p className="text-sm text-muted-foreground">Cek jawaban AI dengan materi dan pertanyaan dosen.</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/dosen/courses/${courseId}/alignment`}>Buka</Link>
          </Button>
        </CardContent>
      </Card>

      {sessionsLoaded && !loadingSessions && activeMaterialCount === 0 && (
        <Card className="border-brand/25 bg-brand/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Siapkan Tutor AI untuk mata kuliah ini</CardTitle>
            <CardDescription>
              Tambahkan materi aktif agar mahasiswa bisa bertanya dengan jawaban yang merujuk ke bahan ajar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ol className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Check className="size-4 text-emerald-600" />
                Mata kuliah sudah dibuat
              </li>
              <li className="flex items-center gap-2">
                {activeSessions.length > 0 ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <span className="size-4 rounded-full border" />
                )}
                Buat sesi perkuliahan
              </li>
              <li className="flex items-center gap-2">
                <span className="size-4 rounded-full border" />
                Tambahkan PDF, tautan, atau materi teks
              </li>
            </ol>
            <Button
              className="shrink-0 bg-brand text-black hover:bg-brand/90"
              onClick={() => {
                if (activeSessions.length === 0) {
                  resetDialog();
                  setDialogOpen(true);
                } else {
                  setExpandedSessions((previous) => Array.from(new Set([...previous, activeSessions[0].id])));
                  document.getElementById("course-sessions")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              {activeSessions.length === 0 ? "Buat sesi pertama" : "Tambah materi"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div id="course-sessions" className="flex scroll-mt-6 flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Sesi Perkuliahan</h2>
            <p className="text-sm text-muted-foreground">Kelola sesi dan materi course ini</p>
          </div>
          <Button
            onClick={() => { resetDialog(); setDialogOpen(true); }}
            className="bg-brand text-black shadow-sm hover:bg-brand/90"
          >
            <Plus data-icon="inline-start" />
            Tambah Sesi
          </Button>
        </div>

        {loadingSessions ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : sessions.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="mb-4 size-12 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="font-medium text-muted-foreground">Belum ada sesi</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                courseId={courseId}
                enrollmentKey={course.enrollmentKey}
                onContentChanged={refreshCourseContent}
                expanded={expandedSessions.includes(session.id)}
                onToggleExpand={() => {
                  setExpandedSessions(prev => 
                    prev.includes(session.id) 
                      ? prev.filter(id => id !== session.id) 
                      : [...prev, session.id]
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog(); }}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[680px]">
          <DialogHeader className="border-b bg-muted/30 px-6 py-4">
            <DialogTitle>Tambah Sesi Baru</DialogTitle>
            <DialogDescription>Buat sesi dan tambahkan materi.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[68vh] flex-col gap-6 overflow-y-auto px-6 py-5">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Judul Sesi <span className="text-destructive">*</span></Label>
                <Input
                  value={sessionForm.title}
                  onChange={(event) => setSessionForm({ ...sessionForm, title: event.target.value })}
                  placeholder="Contoh: Minggu 1 - Pengenalan AI"
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Deskripsi <span className="text-xs font-normal text-muted-foreground">(opsional)</span></Label>
                <textarea
                  value={sessionForm.description}
                  onChange={(event) => setSessionForm({ ...sessionForm, description: event.target.value })}
                  placeholder="Topik yang dibahas"
                  disabled={submitting}
                  rows={2}
                  className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-base font-semibold">Materi Sesi</Label>
                <Button
                  type="button"
                  onClick={() => setNewMaterials((materials) => [...materials, emptyMaterial()])}
                  disabled={submitting}
                  className="bg-brand text-black hover:bg-brand/90"
                >
                  <Plus data-icon="inline-start" />
                  Tambah Materi
                </Button>
              </div>

              {newMaterials.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                  Belum ada materi ditambahkan. Anda bisa menambahkan materi nanti.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {newMaterials.map((material, index) => (
                    <Card key={material.id} className="border-border/60 shadow-sm">
                      <CardContent className="flex flex-col gap-4 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                              <FileText className="size-4" />
                            </div>
                            <p className="text-sm font-semibold">Materi</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="bg-transparent text-destructive shadow-none hover:bg-transparent hover:text-destructive hover:[&_svg]:stroke-[2.5]"
                            onClick={() => setNewMaterials((materials) => materials.filter((item) => item.id !== material.id))}
                            disabled={submitting}
                            aria-label="Hapus materi"
                          >
                            <Trash2 />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Jenis Konten</Label>
                            <Select value={material.type} onValueChange={(value) => updateMaterial(material.id, { type: value as ContentType })} disabled={submitting}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="file">File PDF</SelectItem>
                                <SelectItem value="link">Link URL</SelectItem>
                                <SelectItem value="text">Teks</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Judul <span className="text-destructive">*</span></Label>
                            <Input className="h-8" value={material.title} onChange={(event) => updateMaterial(material.id, { title: event.target.value })} placeholder="Judul materi" disabled={submitting} />
                          </div>

                          {material.type === "file" && (
                            <div className="grid gap-1.5 sm:col-span-2">
                              <Label className="text-xs">File PDF <span className="text-destructive">*</span></Label>
                              <button
                                type="button"
                                onClick={() => fileRefs.current[material.id]?.click()}
                                className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-dashed p-3 text-center transition-colors hover:bg-muted/20"
                              >
                                {material.file ? (
                                  <span className="flex max-w-full items-center gap-2 text-sm">
                                    <FileText className="size-4 text-red-500" />
                                    <span className="truncate font-medium">{material.file.name}</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Upload className="size-3.5" />
                                    Pilih File PDF
                                  </span>
                                )}
                              </button>
                              <input
                                ref={(element) => { fileRefs.current[material.id] = element; }}
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={(event) => updateMaterial(material.id, { file: event.target.files?.[0] || null })}
                              />
                            </div>
                          )}

                          {material.type === "link" && (
                            <div className="grid gap-1.5 sm:col-span-2">
                              <Label className="text-xs">URL <span className="text-destructive">*</span></Label>
                              <Input className="h-8" value={material.url} onChange={(event) => updateMaterial(material.id, { url: event.target.value })} placeholder="https://..." disabled={submitting} />
                            </div>
                          )}

                          {material.type === "text" && (
                            <div className="grid gap-1.5 sm:col-span-2">
                              <Label className="text-xs">Konten Teks <span className="text-destructive">*</span></Label>
                              <textarea
                                value={material.content}
                                onChange={(event) => updateMaterial(material.id, { content: event.target.value })}
                                placeholder="Isi materi teks..."
                                disabled={submitting}
                                rows={3}
                                className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          )}

                          <div className="grid gap-1.5 sm:col-span-2">
                            <Label className="text-xs">Keterangan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
                            <Input className="h-8 text-xs" value={material.description} onChange={(event) => updateMaterial(material.id, { description: event.target.value })} placeholder="Keterangan singkat" disabled={submitting} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t bg-background px-6 py-4">
            <Button className="min-w-24" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className="min-w-28 bg-brand text-black hover:bg-brand/90"
              onClick={handleCreateSession}
              disabled={submitting || !sessionForm.title.trim()}
            >
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Buat Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editCourseOpen}
        onOpenChange={(open) => {
          setEditCourseOpen(open);
          if (!open && course) {
            setCourseForm({
              title: course.title,
              description: course.description ?? "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Detail Course</DialogTitle>
            <DialogDescription>Perbarui judul dan deskripsi course.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Judul Course</Label>
              <Input
                value={courseForm.title}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, title: event.target.value })
                }
                disabled={courseSubmitting}
                placeholder="Judul course"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Deskripsi</Label>
              <textarea
                value={courseForm.description}
                onChange={(event) =>
                  setCourseForm({ ...courseForm, description: event.target.value })
                }
                disabled={courseSubmitting}
                rows={4}
                className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Deskripsi course"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCourseOpen(false)}
              disabled={courseSubmitting}
            >
              Batal
            </Button>
            <Button
              className="bg-brand text-black hover:bg-brand/90"
              onClick={handleUpdateCourseDetails}
              disabled={courseSubmitting || !courseForm.title.trim()}
            >
              {courseSubmitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentListDialog courseId={courseId} enrollmentKey={course.enrollmentKey} open={showStudents} onOpenChange={setShowStudents} />
      <CourseKeyConfirmDialog
        open={!!courseAction}
        onOpenChange={(open) => !open && setCourseAction(null)}
        courseKey={course.enrollmentKey}
        destructive={courseAction?.type === "delete"}
        onConfirm={handleCourseAction}
        {...getCourseActionCopy()}
      />
    </div>
  );
}
