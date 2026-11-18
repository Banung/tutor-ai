import { NextRequest, NextResponse } from "next/server";
import { requireDosen, type RouteContext } from "@/lib/api-utils";
import { queueAlignmentRun } from "@/lib/tutor-ai/alignment-runner";
import { alignmentErrorResponse, alignmentPrivateHeaders } from "../../api-utils";

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  try {
    const { id, alignmentId } = await context.params;
    return NextResponse.json(await queueAlignmentRun(session!.user.id, id, alignmentId), { status: 202, headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}
