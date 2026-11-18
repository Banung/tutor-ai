import type { NextRequest } from "next/server";

export const GENERIC_API_ERROR = "Terjadi kesalahan pada server";

export async function readJsonBody(
  request: NextRequest
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

/** Logs only non-sensitive error metadata; messages/stacks may contain SQL or credentials. */
export function logUnexpectedError(scope: string, error: unknown) {
  const details = (error ?? {}) as { name?: unknown; code?: unknown };
  console.error(`[${scope}] unexpected error`, {
    name: typeof details.name === "string" ? details.name : undefined,
    code: typeof details.code === "string" ? details.code : undefined,
  });
}
