export type PartialProvisioning = {
  userId: string;
  accountState: string;
  message: string;
  issues: string[];
};

/**
 * Recognizes the API's partial-provisioning body: the account exists but
 * role/profile finalization failed. Returns null for ordinary failures.
 */
export function parsePartialProvisioning(
  payload: unknown
): PartialProvisioning | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.partial !== true) return null;
  if (typeof record.userId !== "string" || record.userId.length === 0) {
    return null;
  }

  return {
    userId: record.userId,
    accountState:
      typeof record.accountState === "string"
        ? record.accountState
        : "default_mahasiswa",
    message:
      typeof record.error === "string"
        ? record.error
        : "Akun dibuat tetapi finalisasi profil gagal.",
    issues: Array.isArray(record.issues)
      ? record.issues.filter((issue): issue is string => typeof issue === "string")
      : [],
  };
}
