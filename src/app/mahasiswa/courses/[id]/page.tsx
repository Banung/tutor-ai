"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Users,
  MessageCircle,
} from "lucide-react";
import { CourseHeroCard } from "@/components/courses/course-hero-card";
import { TutorFloatingButton } from "@/components/tutor/tutor-floating-button";
import { MahasiswaSessionCard } from "./session-card";
import type { MahasiswaCourseDetail, SessionItem } from "./types";
import { formatDate } from "./types";

export default function MahasiswaCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<MahasiswaCourseDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const fetchCourse = useCallback(() => {
    setLoading(true);
    fetch(`/api/mahasiswa/courses/${courseId}`)
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
    fetch(`/api/mahasiswa/courses/${courseId}/sessions`)
      .then((response) => {
        if (!response.ok) throw new Error("Not found");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [courseId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCourse();
      fetchSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchCourse, fetchSessions]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <BookOpen className="size-12 text-muted-foreground/50" strokeWidth={1.5} />
        <p>Course tidak ditemukan atau Anda tidak memiliki akses.</p>
        <Button variant="outline" onClick={() => router.push("/mahasiswa/courses")}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/mahasiswa/courses")}
          className="-ml-2 self-start text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft data-icon="inline-start" />
          Kembali ke mata kuliah
        </Button>
        <Button onClick={() => router.push(`/mahasiswa/courses/${courseId}/tutor`)}>
          <MessageCircle data-icon="inline-start" />
          Tanya Tutor AI
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <CourseHeroCard
          title={course.title}
          description={course.description}
          coverImage={course.coverImage}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Sesi Tersedia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand/10">
                  <CalendarDays className="size-5 text-brand" />
                </div>
                <span className="text-3xl font-bold">{sessions.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Dosen Pengampu
              </CardDescription>
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

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Dibuat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <GraduationCap className="size-5 text-emerald-600" />
                </div>
                <span className="text-lg font-bold">{formatDate(course.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {course.instructors.length > 0 && (
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Pengampu Course
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {course.instructors.map((instructor) => (
                <Badge key={instructor.id} variant="secondary" className="px-3 py-1">
                  {instructor.user.name}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sesi Perkuliahan</h2>
          <p className="text-sm text-muted-foreground">
            Buka sesi dan materi yang tersedia untuk course ini
          </p>
        </div>

        {loadingSessions ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="mb-4 size-12 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="font-medium text-muted-foreground">Belum ada sesi aktif</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Sesi akan muncul saat dosen membuka aksesnya.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => (
              <MahasiswaSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>

      <TutorFloatingButton href={`/mahasiswa/courses/${courseId}/tutor`} />
    </div>
  );
}
