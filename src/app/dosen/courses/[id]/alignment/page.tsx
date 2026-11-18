import CourseAlignmentPage from "@/components/dosen/course-alignment-page";

export default async function AlignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseAlignmentPage courseId={id} />;
}
