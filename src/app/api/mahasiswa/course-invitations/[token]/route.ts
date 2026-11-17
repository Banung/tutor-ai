import { NextRequest, NextResponse } from "next/server";
import { requireMahasiswa, type RouteContext } from "@/lib/api-utils";
import { acceptCourseInvitation, getCourseInvitation } from "@/lib/services/course-invitation.service";

export async function GET(request: NextRequest, context: RouteContext) {
  const { error } = await requireMahasiswa(request);
  if (error) return error;
  const { token } = await context.params;
  const course = await getCourseInvitation(token);
  return course ? NextResponse.json(course) : NextResponse.json({ error: "Link undangan tidak valid atau course sudah tidak aktif" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireMahasiswa(request);
  if (error) return error;
  const { token } = await context.params;
  try {
    return NextResponse.json(await acceptCourseInvitation(token, session!.user.id), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal bergabung" }, { status: 400 });
  }
}
