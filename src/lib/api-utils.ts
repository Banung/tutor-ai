import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<Record<string, string>> };

type SessionUser = { role?: string; isFrozen?: boolean; isActive?: boolean };

function isAccountBlocked(session: { user: unknown }) {
  const user = session.user as SessionUser;
  return user.isFrozen === true || user.isActive === false;
}

function blockedResponse() {
  return NextResponse.json(
    { error: "Akun dibekukan atau tidak aktif." },
    { status: 403 }
  );
}

export async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (isAccountBlocked(session)) {
    return { error: blockedResponse(), session: null };
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function requireDosen(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (isAccountBlocked(session)) {
    return { error: blockedResponse(), session: null };
  }
  if ((session.user as { role?: string }).role !== "dosen") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function requireMahasiswa(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (isAccountBlocked(session)) {
    return { error: blockedResponse(), session: null };
  }
  if ((session.user as { role?: string }).role !== "mahasiswa") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export type { RouteContext };
