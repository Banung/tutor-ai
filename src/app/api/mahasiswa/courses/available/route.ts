import { NextRequest, NextResponse } from "next/server";
import { requireMahasiswa } from "@/lib/api-utils";
import {
  searchAvailableCourses,
  type AvailableCoursesEnrollmentFilter,
} from "@/lib/services/mahasiswa.service";

const VALID_ENROLLMENT_FILTERS = new Set<AvailableCoursesEnrollmentFilter>([
  "all",
  "not_enrolled",
  "enrolled",
]);

export async function GET(request: NextRequest) {
  const { error, session } = await requireMahasiswa(request);
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const rawEnrollment = searchParams.get("enrollment")?.trim();

  if (
    rawEnrollment &&
    !VALID_ENROLLMENT_FILTERS.has(rawEnrollment as AvailableCoursesEnrollmentFilter)
  ) {
    return NextResponse.json(
      { error: "Filter status pendaftaran tidak valid" },
      { status: 400 }
    );
  }

  const search = searchParams.get("search") ?? undefined;
  const facultyId = searchParams.get("facultyId") ?? undefined;
  const studyProgramId = searchParams.get("studyProgramId") ?? undefined;
  const enrollment = (rawEnrollment as AvailableCoursesEnrollmentFilter | undefined) ?? undefined;

  try {
    const courses = await searchAvailableCourses(session!.user.id, {
      search,
      facultyId,
      studyProgramId,
      enrollment,
    });

    return NextResponse.json(courses);
  } catch (err) {
    console.error("[mahasiswa.courses.available] unexpected error", err);
    return NextResponse.json(
      { error: "Gagal memuat katalog course" },
      { status: 500 }
    );
  }
}
