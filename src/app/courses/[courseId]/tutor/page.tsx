import { TutorAiChatPage } from "@/components/tutor/tutor-ai-chat-page";

type CourseTutorPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseTutorPage({ params }: CourseTutorPageProps) {
  const { courseId } = await params;

  return (
    <TutorAiChatPage
      courseId={courseId}
      backHref="/mahasiswa"
      tutorHref={`/courses/${courseId}/tutor`}
    />
  );
}
