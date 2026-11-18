import { NextRequest, NextResponse } from "next/server";
import { requireDosen, type RouteContext } from "@/lib/api-utils";
import { createAlignmentSession, getAlignmentOverview, updateAlignmentSettings } from "@/lib/tutor-ai/alignment-service";
import { alignmentErrorResponse, alignmentPrivateHeaders } from "./api-utils";

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  try {
    const { id } = await context.params;
    return NextResponse.json(await getAlignmentOverview(session!.user.id, id), { headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  const payload = await request.json().catch(() => null);
  try {
    const { id } = await context.params;
    const created = await createAlignmentSession(session!.user.id, id, payload);
    return NextResponse.json(created, { status: 201, headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  const payload = await request.json().catch(() => null);
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateAlignmentSettings(session!.user.id, id, payload), { headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}
