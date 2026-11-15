export function getInvitationReturnPath(value: string | null): string | null {
  return value && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
