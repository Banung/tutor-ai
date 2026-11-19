import { TutorAiChatPage } from "@/components/tutor/tutor-ai-chat-page";

type MahasiswaTutorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MahasiswaTutorPage({ params }: MahasiswaTutorPageProps) {
  const { id } = await params;

  return (
    <TutorAiChatPage 
      key={id}
      courseId={id} 
      backHref="/mahasiswa" 
      tutorHref={`/mahasiswa/courses/${id}/tutor`}
      courseBaseHref="/mahasiswa/courses"
    />
  );
}
