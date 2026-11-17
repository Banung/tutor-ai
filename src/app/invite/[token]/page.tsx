"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CoursePreview = { id: string; title: string; description: string | null };

export default function CourseInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CoursePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/mahasiswa/course-invitations/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? "Silakan login sebagai mahasiswa untuk membuka undangan ini." : data.error);
        setCourse(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Undangan tidak dapat dibuka"));
  }, [token]);

  async function joinCourse() {
    setBusy(true);
    try {
      const response = await fetch(`/api/mahasiswa/course-invitations/${encodeURIComponent(token)}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Gagal bergabung ke course");
      router.replace(`/mahasiswa/courses/${data.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bergabung ke course");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="size-5" /> Undangan Course</CardTitle>
          <CardDescription>{course ? "Anda diundang untuk bergabung ke course berikut." : "Memeriksa undangan..."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {course && <div><h2 className="text-lg font-semibold">{course.title}</h2><p className="mt-1 text-sm text-muted-foreground">{course.description || "Belum ada deskripsi"}</p></div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!course && !error && <Loader2 className="size-5 animate-spin" />}
          {course && <Button onClick={joinCourse} disabled={busy}>{busy && <Loader2 className="animate-spin" data-icon="inline-start" />}Gabung ke Course</Button>}
          {error.includes("login") && <Button variant="outline" onClick={() => router.push(`/login?${new URLSearchParams({ returnTo: `/invite/${token}` })}`)}>Login</Button>}
        </CardContent>
      </Card>
    </main>
  );
}
