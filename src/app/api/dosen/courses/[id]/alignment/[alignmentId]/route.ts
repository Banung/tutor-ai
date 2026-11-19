import { NextRequest, NextResponse } from "next/server";
import { requireDosen, type RouteContext } from "@/lib/api-utils";
import { getAlignmentSession } from "@/lib/tutor-ai/alignment-service";
import { alignmentErrorResponse, alignmentPrivateHeaders } from "../api-utils";

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireDosen(request);
  if (error) return error;
  try {
    const { id, alignmentId } = await context.params;
    return NextResponse.json(await getAlignmentSession(session!.user.id, id, alignmentId), { headers: alignmentPrivateHeaders });
  } catch (failure) {
    return alignmentErrorResponse(failure);
  }
}
