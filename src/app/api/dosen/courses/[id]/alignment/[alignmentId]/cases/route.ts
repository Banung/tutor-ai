import { NextRequest, NextResponse } from "next/server";
import { requireDosen, type RouteContext } from "@/lib/api-utils";
import { addManualAlignmentCase } from "@/lib/tutor-ai/alignment-service";
import { alignmentErrorResponse, alignmentPrivateHeaders } from "../../api-utils";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  const payload = await request.json().catch(() => null);
  try {
    const { id, alignmentId } = await context.params;
    const created = await addManualAlignmentCase(session!.user.id, id, alignmentId, payload);
    return NextResponse.json(created, { status: 201, headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}
