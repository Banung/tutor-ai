import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type RouteContext } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { updateUserSchema } from "@/lib/schemas/user.schema";
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
    const user = await userService.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (err) {
    return toErrorResponse("admin.users.get", err);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = updateUserSchema.safeParse(body.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const user = await userService.updateUser(id, result.data, session!.user.id);
    return NextResponse.json(user);
  } catch (err) {
    return toErrorResponse("admin.users.update", err);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const { id } = await context.params;

  try {
    await userService.deleteUser(id, session!.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse("admin.users.delete", err);
  }
}
