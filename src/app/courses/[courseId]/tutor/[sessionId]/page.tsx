import { TutorAiChatPage } from "@/components/tutor/tutor-ai-chat-page";

type CourseTutorSessionPageProps = {
  params: Promise<{ courseId: string; sessionId: string }>;
};

export default async function CourseTutorSessionPage({
  params,
}: CourseTutorSessionPageProps) {
  const { courseId, sessionId } = await params;

  return (
    <TutorAiChatPage
      courseId={courseId}
      backHref="/mahasiswa"
      tutorHref={`/courses/${courseId}/tutor`}
      initialSessionId={sessionId}
    />
  );
}
