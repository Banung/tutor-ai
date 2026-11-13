import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  validateUserProfile,
  type AcademicLevel,
  type CreateUserInput,
  type UpdateUserInput,
  type UserFilter,
  type UserRole,
} from "@/lib/schemas/user.schema";

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly issues?: string[]
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

/**
 * The Better Auth account exists but role/profile finalization did not commit.
 * The account is retained in its default mahasiswa state and can be repaired
 * through a normal edit. Never thrown to a revoked actor.
 */
export class UserProvisioningError extends UserServiceError {
  constructor(
    message: string,
    status: number,
    readonly userId: string,
    readonly accountState: "default_mahasiswa" = "default_mahasiswa",
    issues: string[] = []
  ) {
    super(message, status, issues);
    this.name = "UserProvisioningError";
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  academicLevel: true,
  npm: true,
  nip: true,
  nidn: true,
  major: true,
  faculty: true,
  bio: true,
  createdAt: true,
} as const;

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

function uniqueMessage(error: unknown): string {
  const target = (error as { meta?: { target?: unknown } })?.meta?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (text.includes("nip")) return "NIP sudah digunakan.";
  if (text.includes("nidn")) return "NIDN sudah digunakan.";
  if (text.includes("npm")) return "NPM sudah digunakan.";
  if (text.includes("email")) return "Email sudah digunakan.";
  return "Nilai unik sudah digunakan.";
}

/**
 * Lock order: user rows only, always ascending by id. No course row is ever
 * acquired while holding a user lock, so role changes and instructor
 * assignment cannot form a lock cycle.
 */
async function lockUsers(tx: Prisma.TransactionClient, ids: string[]) {
  for (const lockId of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${lockId} FOR UPDATE`;
  }
}

export async function listUsers(filter: UserFilter) {
  const where: Record<string, unknown> = {};

  if (filter.role) {
    where.role = filter.role;
  }
  if (filter.academicLevel) {
    where.academicLevel = filter.academicLevel;
  }
  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
      { npm: { contains: filter.search, mode: "insensitive" } },
      { nip: { contains: filter.search, mode: "insensitive" } },
      { nidn: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { ...userSelect, updatedAt: true },
  });
}

export async function createUser(
  data: CreateUserInput,
  actorId: string,
  txTimeoutMs?: number
) {
  const role = data.role;
  const profile = {
    npm: role === "mahasiswa" ? (data.npm ?? null) : null,
    academicLevel: role === "mahasiswa" ? (data.academicLevel ?? null) : null,
    nip: role === "dosen" ? (data.nip ?? null) : null,
    nidn: role === "dosen" ? (data.nidn ?? null) : null,
  };

  // Preflight known conflicts before the account exists, so an ordinary
  // duplicate is a plain 4xx. Unique constraints still cover the race window.
  const email = data.email.toLowerCase();
  const knownEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (knownEmail) {
    throw new UserServiceError("Email sudah digunakan.", 409);
  }
  for (const field of ["npm", "nip", "nidn"] as const) {
    const value = profile[field];
    if (!value) continue;
    const conflict = await prisma.user.findFirst({
      where: { [field]: value },
      select: { id: true },
    });
    if (conflict) {
      throw new UserServiceError(`${field.toUpperCase()} sudah digunakan.`, 409);
    }
  }

  let createdId: string;

  try {
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password: data.password,
        name: data.name,
      },
    });
    if (!response?.user?.id) {
      throw new UserServiceError("Gagal membuat akun pengguna.", 500);
    }
    createdId = response.user.id;
  } catch (error) {
    if (error instanceof UserServiceError) throw error;
    const details = error as { status?: unknown; body?: { code?: unknown } };
    if (
      details.status === 422 ||
      details.status === 409 ||
      details.body?.code === "USER_ALREADY_EXISTS" ||
      details.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
    ) {
      throw new UserServiceError("Email sudah digunakan.", 409);
    }
    throw new UserServiceError("Gagal membuat akun pengguna.", 500);
  }

  try {
    // The Better Auth account already exists at this point. Finalization is one
    // transaction, so an elevated role is never left without its audit row. The
    // account is never deleted as compensation: a failure leaves the default
    // mahasiswa account for an admin to repair through edit.
    return await prisma.$transaction(async (tx) => {
      // Same deterministic order as updateUser: user rows, ascending by id.
      await lockUsers(tx, [actorId, createdId]);

      const [actor, current] = await Promise.all([
        tx.user.findUnique({
          where: { id: actorId },
          select: { id: true, role: true },
        }),
        tx.user.findUnique({
          where: { id: createdId },
          select: { id: true, role: true },
        }),
      ]);

      if (!current) {
        throw new UserProvisioningError(
          "Akun dibuat tetapi data akun tidak ditemukan saat finalisasi.",
          500,
          createdId
        );
      }
      // Authoritative recheck: an actor demoted during signup must not finalize
      // an elevated role. Revoked actors receive no recovery details.
      if (!actor || actor.role !== "admin") {
        throw new UserServiceError("Akses admin diperlukan.", 403);
      }

      const updated = await tx.user.update({
        where: { id: createdId },
        data: {
          name: data.name,
          role,
          ...profile,
          major: data.major ?? null,
          faculty: data.faculty ?? null,
          bio: data.bio ?? null,
        },
        select: userSelect,
      });

      if (current.role !== role) {
        await tx.userRoleAudit.create({
          data: {
            id: crypto.randomUUID(),
            userId: createdId,
            actorId,
            fromRole: current.role,
            toRole: role,
          },
        });
      }

      return updated;
    }, txTimeoutMs ? { timeout: txTimeoutMs } : undefined);
  } catch (error) {
    if (error instanceof UserServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      const issue = uniqueMessage(error);
      throw new UserProvisioningError(
        `Akun dibuat tetapi finalisasi gagal: ${issue}`,
        409,
        createdId,
        "default_mahasiswa",
        [issue]
      );
    }
    throw new UserProvisioningError(
      "Akun dibuat tetapi finalisasi profil/peran gagal. Perbaiki akun ini melalui edit pengguna.",
      500,
      createdId,
      "default_mahasiswa",
      ["Finalisasi profil/peran gagal; akun tetap berperan mahasiswa."]
    );
  }
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  actorId: string,
  txTimeoutMs?: number
) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockUsers(tx, [actorId, id]);

      const [actor, existing] = await Promise.all([
        tx.user.findUnique({
          where: { id: actorId },
          select: { id: true, role: true },
        }),
        tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            role: true,
            npm: true,
            academicLevel: true,
            nip: true,
            nidn: true,
          },
        }),
      ]);

      if (!existing) {
        throw new UserServiceError("User tidak ditemukan.", 404);
      }
      if (!actor || actor.role !== "admin") {
        throw new UserServiceError("Akses admin diperlukan.", 403);
      }

      const nextRole = (data.role ?? existing.role) as UserRole;
      const roleChanged = nextRole !== existing.role;

      if (roleChanged && actorId === id) {
        throw new UserServiceError(
          "Tidak dapat mengubah peran akun sendiri.",
          403
        );
      }

      const merged = {
        npm: data.npm !== undefined ? data.npm : existing.npm,
        academicLevel: (data.academicLevel !== undefined
          ? data.academicLevel
          : existing.academicLevel) as AcademicLevel | null,
        nip: data.nip !== undefined ? data.nip : existing.nip,
        nidn: data.nidn !== undefined ? data.nidn : existing.nidn,
      };

      // Role changes clear incompatible fields explicitly; unrelated profile
      // edits never do. The merged result is what gets validated.
      if (roleChanged) {
        if (nextRole === "mahasiswa") {
          merged.nip = null;
          merged.nidn = null;
        } else {
          merged.npm = null;
          merged.academicLevel = null;
          if (nextRole === "admin") {
            merged.nip = null;
            merged.nidn = null;
          }
        }
      }

      if (roleChanged && existing.role === "dosen" && nextRole !== "dosen") {
        const assignments = await tx.courseInstructor.count({
          where: { userId: id },
        });
        if (assignments > 0) {
          throw new UserServiceError(
            "Dosen yang masih menjadi pengampu course tidak dapat diubah perannya. Lepaskan penugasan terlebih dahulu.",
            409
          );
        }
      }

      const issues = validateUserProfile({ role: nextRole, ...merged });
      if (issues.length > 0) {
        throw new UserServiceError(issues[0], 400, issues);
      }

      for (const field of ["npm", "nip", "nidn"] as const) {
        const value = merged[field];
        if (!value) continue;
        const duplicate = await tx.user.findFirst({
          where: { [field]: value, id: { not: id } },
          select: { id: true },
        });
        if (duplicate) {
          throw new UserServiceError(
            `${field.toUpperCase()} sudah digunakan.`,
            409
          );
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email.toLowerCase() }),
          ...(roleChanged && { role: nextRole }),
          npm: merged.npm,
          academicLevel: merged.academicLevel,
          nip: merged.nip,
          nidn: merged.nidn,
          ...(data.major !== undefined && { major: data.major }),
          ...(data.faculty !== undefined && { faculty: data.faculty }),
          ...(data.bio !== undefined && { bio: data.bio }),
        },
        select: userSelect,
      });

      if (roleChanged) {
        await tx.userRoleAudit.create({
          data: {
            id: crypto.randomUUID(),
            userId: id,
            actorId,
            fromRole: existing.role,
            toRole: nextRole,
          },
        });
      }

      return updated;
    }, txTimeoutMs ? { timeout: txTimeoutMs } : undefined);
  } catch (error) {
    if (error instanceof UserServiceError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new UserServiceError(uniqueMessage(error), 409);
    }
    throw error;
  }
}

export async function deleteUser(id: string, actorId: string) {
  if (id === actorId) {
    throw new UserServiceError("Tidak dapat menghapus akun sendiri.", 403);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new UserServiceError("User tidak ditemukan.", 404);
  }

  await prisma.user.delete({ where: { id } });
  return { success: true };
}

export async function getUserStats() {
  const [total, admin, dosen, mahasiswa] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "dosen" } }),
    prisma.user.count({ where: { role: "mahasiswa" } }),
  ]);

  return { total, admin, dosen, mahasiswa };
}
