import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import {
  GENERIC_API_ERROR,
  logUnexpectedError,
  readJsonBody,
} from "@/lib/api-errors";
import { createUserSchema, userFilterSchema } from "@/lib/schemas/user.schema";
import * as userService from "@/lib/services/user.service";

function toErrorResponse(scope: string, err: unknown) {
  if (err instanceof userService.UserProvisioningError) {
    return NextResponse.json(
      {
        partial: true,
        userId: err.userId,
        accountState: err.accountState,
        error: err.message,
        issues: err.issues ?? [],
      },
      { status: err.status }
    );
  }
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

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const filterResult = userFilterSchema.safeParse({
    role: searchParams.get("role") || undefined,
    academicLevel: searchParams.get("academicLevel") || undefined,
    search: searchParams.get("search") || undefined,
  });

  if (!filterResult.success) {
    return NextResponse.json({ error: "Parameter filter tidak valid" }, { status: 400 });
  }

  try {
    const users = await userService.listUsers(filterResult.data);
    return NextResponse.json(users);
  } catch (err) {
    return toErrorResponse("admin.users.list", err);
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const result = createUserSchema.safeParse(body.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues }, { status: 400 });
  }

  try {
    const user = await userService.createUser(result.data, session!.user.id);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return toErrorResponse("admin.users.create", err);
  }
}
