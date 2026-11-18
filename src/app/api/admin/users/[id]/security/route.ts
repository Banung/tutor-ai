import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { userSecurityActionSchema } from "@/lib/schemas/user.schema";
import * as userService from "@/lib/services/user.service";

function toErrorResponse(scope: string, err: unknown) {
  if (err instanceof userService.UserServiceError) {
    return NextResponse.json(
      {
        error: err.message,
        ...(err.issues && { issues: err.issues }),
      },
      { status: err.status }
    );
  }
  logUnexpectedError(scope, err);
  return NextResponse.json({ error: GENERIC_API_ERROR }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;

  try {
    const logs = await userService.listUserSecurityLogs(id);
    return NextResponse.json({ logs });
  } catch (err) {
    return toErrorResponse("admin.users.security.get", err);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = userSecurityActionSchema.safeParse(body.data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message);
    return NextResponse.json(
      { error: issues[0] ?? "Input tidak valid.", issues },
      { status: 400 }
    );
  }

  try {
    const outcome = await userService.executeUserSecurityAction(
      id,
      result.data,
      session!.user.id
    );
    return NextResponse.json(outcome);
  } catch (err) {
    return toErrorResponse("admin.users.security.post", err);
  }
}
