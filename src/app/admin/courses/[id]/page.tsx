"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserSelectionDialog } from "@/components/admin/user-selection-dialog";
import { CourseMaterialsPanel } from "./course-materials-panel";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Trash2,
  Loader2,
  Copy,
  KeyRound,
  Users,
  GraduationCap,
  Archive,
  Boxes,
  BookOpen,
  Globe,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface Instructor {
  id: string;
  user: { id: string; name: string; email: string };
  assignedAt: string;
}

interface CourseDetail {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  learningOutcomes: string | null;
  coverImage: string | null;
  coverStoragePath: string | null;
  enrollmentKey: string;
  isActive: boolean;
  hasArModule: boolean;
  catalogStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  studyProgramId: string | null;
  studyProgram: {
    id: string;
    name: string;
    faculty: { id: string; name: string };
  } | null;
  createdAt: string;
  creator: { id: string; name: string };
  instructors: Instructor[];
  _count: { enrollments: number };
}

interface Enrollment {
  id: string;
  isActive: boolean;
  enrolledAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    npm: string | null;
    academicLevel: string | null;
    major: string | null;
    faculty: string | null;
  };
}

interface Dosen {
  id: string;
  name: string;
  email: string;
}

interface Mahasiswa {
  id: string;
  name: string;
  email: string;
  npm: string | null;
  major: string | null;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [activeTab, setActiveTab] = useState("materials");

  // Assign instructor
  const [assignOpen, setAssignOpen] = useState(false);
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  const [selectedDosenIds, setSelectedDosenIds] = useState<string[]>([]);
  const [dosenSearchInput, setDosenSearchInput] = useState("");
  const [dosenSearchQuery, setDosenSearchQuery] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Remove instructor
  const [removeInstructor, setRemoveInstructor] = useState<Instructor | null>(null);
  const [removing, setRemoving] = useState(false);

  // Enroll student
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [selectedMahasiswaIds, setSelectedMahasiswaIds] = useState<string[]>([]);
  const [mahasiswaSearchInput, setMahasiswaSearchInput] = useState("");
  const [mahasiswaSearchQuery, setMahasiswaSearchQuery] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  // Remove enrollment
  const [removeEnrollment, setRemoveEnrollment] = useState<Enrollment | null>(null);
  const [removingEnrollment, setRemovingEnrollment] = useState(false);

  // Archive
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Publication
  const [publicationAction, setPublicationAction] = useState<
    "publish" | "unpublish" | null
  >(null);
  const [publishing, setPublishing] = useState(false);
  const [publicationIssues, setPublicationIssues] = useState<
    { field: string; message: string }[] | null
  >(null);

  const fetchCourse = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/courses/${courseId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        setCourse(r.ok && data && !data.error ? data : null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  const fetchEnrollments = useCallback(() => {
    setLoadingEnrollments(true);
    fetch(`/api/admin/courses/${courseId}/enrollments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEnrollments(data);
      })
      .catch(console.error)
      .finally(() => setLoadingEnrollments(false));
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
    fetchEnrollments();
  }, [fetchCourse, fetchEnrollments]);

  async function openAssignDialog() {
    setAssignOpen(true);
    setSelectedDosenIds([]);
    setDosenSearchInput("");
    setDosenSearchQuery("");
    try {
      const res = await fetch("/api/admin/dosen");
      const data = await res.json();
      if (Array.isArray(data)) setDosenList(data);
    } catch {
      toast.error("Gagal memuat daftar dosen");
    }
  }

  async function handleAssign() {
    if (selectedDosenIds.length === 0) return;
    setAssigning(true);
    try {
      const promises = selectedDosenIds.map(id => 
        fetch(`/api/admin/courses/${courseId}/instructors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id }),
        }).then(res => {
            if (!res.ok) throw new Error("Gagal");
            return res.json();
        })
      );
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === "fulfilled").length;
      
      if (successCount > 0) toast.success(`${successCount} Dosen berhasil ditambahkan`);
      if (successCount < selectedDosenIds.length) toast.error("Beberapa dosen gagal ditambahkan");
      
      setAssignOpen(false);
      fetchCourse();
    } catch {
      toast.error("Terjadi kesalahan saat menambahkan dosen");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove() {
    if (!removeInstructor) return;
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/instructors?userId=${removeInstructor.user.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Gagal menghapus dosen");
      toast.success("Dosen berhasil dihapus dari course");
      setRemoveInstructor(null);
      fetchCourse();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus dosen");
    } finally {
      setRemoving(false);
    }
  }

  async function openEnrollDialog() {
    setEnrollOpen(true);
    setSelectedMahasiswaIds([]);
    setMahasiswaSearchInput("");
    setMahasiswaSearchQuery("");
    try {
      const res = await fetch("/api/admin/mahasiswa");
      const data = await res.json();
      if (Array.isArray(data)) setMahasiswaList(data);
    } catch {
      toast.error("Gagal memuat daftar mahasiswa");
    }
  }

  const availableMahasiswa = mahasiswaList.filter(
    (m) => !enrollments.some((e) => e.user.id === m.id) &&
           (m.name.toLowerCase().includes(mahasiswaSearchQuery.toLowerCase()) || 
            m.email.toLowerCase().includes(mahasiswaSearchQuery.toLowerCase()) ||
            (m.npm && m.npm.includes(mahasiswaSearchQuery)))
  );

  const availableDosen = dosenList.filter(
    (d) => !course?.instructors.some((i) => i.user.id === d.id) &&
           (d.name.toLowerCase().includes(dosenSearchQuery.toLowerCase()) || 
            d.email.toLowerCase().includes(dosenSearchQuery.toLowerCase()))
  );

  async function handleEnroll() {
    if (selectedMahasiswaIds.length === 0) return;
    setEnrolling(true);
    try {
      const promises = selectedMahasiswaIds.map(id => 
        fetch(`/api/admin/courses/${courseId}/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id }),
        }).then(res => {
            if (!res.ok) throw new Error("Gagal");
            return res.json();
        })
      );
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === "fulfilled").length;
      
      if (successCount > 0) toast.success(`${successCount} Mahasiswa berhasil didaftarkan`);
      if (successCount < selectedMahasiswaIds.length) toast.error("Beberapa mahasiswa gagal didaftarkan");
      
      setEnrollOpen(false);
      fetchEnrollments();
      fetchCourse();
    } catch {
      toast.error("Terjadi kesalahan saat mendaftarkan mahasiswa");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemoveEnrollment() {
    if (!removeEnrollment) return;
    setRemovingEnrollment(true);
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/enrollments?userId=${removeEnrollment.user.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Gagal menghapus enrollment");
      toast.success("Mahasiswa berhasil dihapus dari course");
      setRemoveEnrollment(null);
      fetchEnrollments();
      fetchCourse();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus enrollment");
    } finally {
      setRemovingEnrollment(false);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    toast.success("Enrollment key disalin");
  }

  async function handlePublication() {
    if (!publicationAction || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/publication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: publicationAction }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (Array.isArray(data?.missingFields) && data.missingFields.length > 0) {
          setPublicationIssues(data.missingFields);
          setPublicationAction(null);
          return;
        }
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Gagal mengubah status publikasi"
        );
      }

      const publish = publicationAction === "publish";
      toast.success(
        publish
          ? data?.changed
            ? "Course dipublikasikan ke katalog"
            : "Course sudah dipublikasikan"
          : data?.changed
            ? "Course ditarik dari katalog"
            : "Course sudah berstatus draft"
      );
      setPublicationAction(null);
      fetchCourse();
      fetchEnrollments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah status publikasi"
      );
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/archive`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Gagal mengarsipkan course"
        );
      }
      toast.success("Course berhasil diarsipkan");
      setArchiveOpen(false);
      fetchCourse();
      fetchEnrollments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan course");
    } finally {
      setArchiving(false);
    }
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
        <p>Course tidak ditemukan</p>
        <Button variant="outline" onClick={() => router.push("/admin/courses")}>
          Kembali
        </Button>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate" title={course.title}>
              {course.title}
            </h1>
            {course.courseCode && (
              <span className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                {course.courseCode}
              </span>
            )}
            <Badge variant={course.catalogStatus === "PUBLISHED" ? "default" : "secondary"} className="shrink-0">
              {course.catalogStatus === "PUBLISHED"
                ? "Dipublikasikan"
                : course.catalogStatus === "ARCHIVED"
                  ? "Diarsipkan"
                  : "Draft"}
            </Badge>
            <Badge variant={course.isActive ? "default" : "secondary"} className="shrink-0">
              {course.isActive ? "Akses aktif" : "Akses nonaktif"}
            </Badge>
          </div>
          {course.description && (
            <p className="text-muted-foreground whitespace-pre-wrap break-words mt-2 text-sm leading-relaxed max-w-3xl">
              {course.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {course.catalogStatus === "DRAFT" && (
            <Button
              onClick={() => setPublicationAction("publish")}
              className="gap-2 bg-brand text-black hover:bg-brand/90"
            >
              <Globe data-icon="inline-start" />
              Publikasikan
            </Button>
          )}
          {course.catalogStatus === "PUBLISHED" && (
            <Button
              variant="outline"
              onClick={() => setPublicationAction("unpublish")}
              className="gap-2"
            >
              <EyeOff data-icon="inline-start" />
              Tarik dari katalog
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setArchiveOpen(true)}
            disabled={course.catalogStatus === "ARCHIVED"}
            className="shrink-0 gap-2"
          >
            <Archive data-icon="inline-start" />
            {course.catalogStatus === "ARCHIVED" ? "Sudah diarsipkan" : "Arsipkan"}
          </Button>
        </div>
      </div>

      {/* Academic profile */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div
          className="h-40 rounded-xl border bg-muted bg-cover bg-center"
          style={
            course.coverImage
              ? { backgroundImage: `url("${course.coverImage}")` }
              : undefined
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Program Studi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {course.studyProgram?.name ?? "Belum ditentukan"}
              </p>
              <p className="text-sm text-muted-foreground">
                {course.studyProgram?.faculty.name ?? "Referensi akademik belum diisi"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Modul AR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 font-medium">
                <Boxes className="size-4 text-brand" />
                {course.hasArModule ? "Tersedia" : "Belum tersedia"}
              </p>
              <p className="text-sm text-muted-foreground">Metadata katalog</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 sm:col-span-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <BookOpen className="size-3.5" />
                Capaian Pembelajaran
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {course.learningOutcomes || "Belum diisi"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Enrollment Key</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => copyKey(course.enrollmentKey)}
              className="inline-flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-sm transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-brand" />
                <span className="font-bold">{course.enrollmentKey}</span>
              </div>
              <Copy className="size-3.5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50">
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
        <Card className="overflow-hidden border-border/50">
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
      </div>



      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <TabsList className="!h-10 p-1 flex items-center w-full sm:w-fit">
            <TabsTrigger value="materials" className="flex-1 px-4 h-full sm:flex-none">Sesi & Materi</TabsTrigger>
            <TabsTrigger value="instructors" className="flex-1 px-4 h-full sm:flex-none">Dosen Pengampu</TabsTrigger>
            <TabsTrigger value="enrollments" className="flex-1 px-4 h-full sm:flex-none">Mahasiswa Terdaftar</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="m-0 hidden sm:block" />
          <TabsContent value="instructors" className="m-0 sm:flex-none flex sm:justify-end">
            <Button
              onClick={openAssignDialog}
              className="w-full sm:w-auto gap-2 h-10 bg-brand text-black hover:bg-brand/90 px-5"
            >
              <UserPlus data-icon="inline-start" />
              Tambah Dosen
            </Button>
          </TabsContent>
          <TabsContent value="enrollments" className="m-0 sm:flex-none flex sm:justify-end">
            <Button
              onClick={openEnrollDialog}
              className="w-full sm:w-auto gap-2 h-10 bg-brand text-black hover:bg-brand/90 px-5"
            >
              <GraduationCap data-icon="inline-start" />
              Tambah Mahasiswa
            </Button>
          </TabsContent>
        </div>

        {/* Instructors Tab Table */}
        <TabsContent value="instructors" className="mt-0">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ditugaskan</TableHead>
                  <TableHead className="w-[80px] text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {course.instructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      Belum ada dosen yang ditugaskan
                    </TableCell>
                  </TableRow>
                ) : (
                  course.instructors.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="pl-6 font-medium max-w-[200px] truncate" title={inst.user.name}>
                        {inst.user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={inst.user.email}>
                        {inst.user.email}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(inst.assignedAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setRemoveInstructor(inst)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Enrollments Tab */}
        <TabsContent value="enrollments">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Nama Mahasiswa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>NPM</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Jurusan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="w-[80px] text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEnrollments ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                      Belum ada mahasiswa yang terdaftar
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="pl-6 font-medium max-w-[180px] truncate" title={enrollment.user.name}>
                        {enrollment.user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate" title={enrollment.user.email}>
                        {enrollment.user.email}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{enrollment.user.npm ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{enrollment.user.academicLevel ?? "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={enrollment.user.major ?? "—"}>
                        {enrollment.user.major ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${enrollment.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {enrollment.isActive ? "Aktif" : "Dicabut"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(enrollment.enrolledAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setRemoveEnrollment(enrollment)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="materials">
          <CourseMaterialsPanel courseId={courseId} />
        </TabsContent>
      </Tabs>

      {/* Assign Instructor Dialog */}
      <UserSelectionDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Tambah Dosen Pengampu"
        description="Pilih dosen yang akan ditugaskan ke course ini."
        searchPlaceholder="Cari nama atau email dosen..."
        searchInput={dosenSearchInput}
        onSearchInputChange={setDosenSearchInput}
        onSearch={setDosenSearchQuery}
        availableItems={availableDosen.map(d => ({ id: d.id, name: d.name, email: d.email }))}
        selectedIds={selectedDosenIds}
        onSelectedIdsChange={setSelectedDosenIds}
        emptyStateIcon={<Users className="size-12" />}
        emptyStateText="Semua dosen sudah ditugaskan atau tidak ditemukan"
        itemNoun="dosen"
        submitLabel="Tugaskan"
        onSubmit={handleAssign}
        isSubmitting={assigning}
      />

      {/* Remove Instructor Confirmation */}
      <AlertDialog open={!!removeInstructor} onOpenChange={(open) => !open && setRemoveInstructor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dosen dari Course</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{removeInstructor?.user.name}</strong> dari
              course ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removing && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enroll Student Dialog */}
      <UserSelectionDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        title="Tambah Mahasiswa"
        description="Pilih mahasiswa yang akan didaftarkan ke course ini."
        searchPlaceholder="Cari NPM, nama, atau email..."
        searchInput={mahasiswaSearchInput}
        onSearchInputChange={setMahasiswaSearchInput}
        onSearch={setMahasiswaSearchQuery}
        availableItems={availableMahasiswa.map(m => ({ 
          id: m.id, 
          name: m.name, 
          email: m.email,
          badge: m.npm,
          subText: m.major
        }))}
        selectedIds={selectedMahasiswaIds}
        onSelectedIdsChange={setSelectedMahasiswaIds}
        emptyStateIcon={<GraduationCap className="size-12" />}
        emptyStateText="Semua mahasiswa sudah terdaftar atau tidak ditemukan"
        itemNoun="mahasiswa"
        submitLabel="Daftarkan"
        onSubmit={handleEnroll}
        isSubmitting={enrolling}
      />

      {/* Remove Enrollment Confirmation */}
      <AlertDialog open={!!removeEnrollment} onOpenChange={(open) => !open && setRemoveEnrollment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mahasiswa dari Course</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{removeEnrollment?.user.name}</strong> dari
              course ini? Data enrollment akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingEnrollment}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveEnrollment}
              disabled={removingEnrollment}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removingEnrollment && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Archive Confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan Course</AlertDialogTitle>
            <AlertDialogDescription>
              Course <strong>{course.title}</strong> akan ditandai sebagai arsip dan hilang
              dari pencarian mahasiswa. Course, enrollment, sesi, materi, serta riwayat
              percakapan tetap tersimpan. Status akses kelas tidak berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Arsipkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publication Confirmation */}
      <AlertDialog
        open={!!publicationAction}
        onOpenChange={(open) => !open && !publishing && setPublicationAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {publicationAction === "publish"
                ? "Publikasikan Course"
                : "Tarik Course dari Katalog"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {publicationAction === "publish" ? (
                <>
                  Course <strong>{course.title}</strong> akan tampil di katalog dan
                  dapat di-enroll mandiri oleh mahasiswa. Status akses kelas tidak
                  berubah.
                </>
              ) : (
                <>
                  Course <strong>{course.title}</strong> akan disembunyikan dari
                  katalog dan enrollment mandiri. Mahasiswa yang sudah terdaftar tetap
                  memiliki akses ke kelas, sesi, materi, dan riwayat percakapan. Status
                  akses kelas tidak berubah.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublication} disabled={publishing}>
              {publishing && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {publicationAction === "publish"
                ? "Publikasikan"
                : "Tarik dari katalog"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publication completeness */}
      <AlertDialog
        open={!!publicationIssues}
        onOpenChange={(open) => !open && setPublicationIssues(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Data belum lengkap</AlertDialogTitle>
            <AlertDialogDescription>
              Lengkapi data berikut sebelum mempublikasikan entri:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {publicationIssues?.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPublicationIssues(null)}>
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
