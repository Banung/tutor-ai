import { MahasiswaCatalogClient } from "./catalog-client";
import type { AvailableCoursesEnrollmentFilter } from "@/lib/services/mahasiswa.service";

function sanitizeEnrollmentFilter(value?: string): AvailableCoursesEnrollmentFilter {
  if (value === "not_enrolled" || value === "enrolled") {
    return value;
  }
  return "all";
}

export default async function MahasiswaCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    facultyId?: string;
    studyProgramId?: string;
    enrollment?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <MahasiswaCatalogClient
      initialSearch={params.q ?? ""}
      initialFacultyId={params.facultyId ?? ""}
      initialStudyProgramId={params.studyProgramId ?? ""}
      initialEnrollment={sanitizeEnrollmentFilter(params.enrollment)}
    />
  );
}
