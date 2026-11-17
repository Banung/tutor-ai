import { TutorAiChatPage } from "@/components/tutor/tutor-ai-chat-page";

type MahasiswaTutorSessionPageProps = {
  params: Promise<{ id: string; sessionId: string }>;
};

export default async function MahasiswaTutorSessionPage({
  params,
}: MahasiswaTutorSessionPageProps) {
  const { id, sessionId } = await params;

  return (
    <TutorAiChatPage
      key={id}
      courseId={id}
      backHref={`/mahasiswa/courses/${id}`}
      tutorHref={`/mahasiswa/courses/${id}/tutor`}
      courseBaseHref="/mahasiswa/courses"
      initialSessionId={sessionId}
    />
  );
}
