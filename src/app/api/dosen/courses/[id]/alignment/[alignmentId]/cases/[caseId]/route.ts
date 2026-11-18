import { NextRequest, NextResponse } from "next/server";
import { requireDosen, type RouteContext } from "@/lib/api-utils";
import { deleteAlignmentCase, updateAlignmentCase } from "@/lib/tutor-ai/alignment-service";
import { alignmentErrorResponse, alignmentPrivateHeaders } from "../../../api-utils";

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  const payload = await request.json().catch(() => null);
  try {
    const { id, alignmentId, caseId } = await context.params;
    return NextResponse.json(await updateAlignmentCase(session!.user.id, id, alignmentId, caseId, payload), { headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  try {
    const { id, alignmentId, caseId } = await context.params;
    return NextResponse.json(await deleteAlignmentCase(session!.user.id, id, alignmentId, caseId), { headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}
