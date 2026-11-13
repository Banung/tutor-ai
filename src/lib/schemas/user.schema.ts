import { z } from "zod/v4";

export const ROLES = ["admin", "dosen", "mahasiswa"] as const;
export const ACADEMIC_LEVELS = ["S1", "S2", "S3"] as const;

export type UserRole = (typeof ROLES)[number];
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const IDENTIFIER_MESSAGE = "NIM/NIP harus berupa angka 8–18 digit.";

const IDENTIFIER_PATTERN = /^[0-9]{8,18}$/;

/**
 * Trims, keeps leading zeros as text, and normalizes blank optional values to null.
 * `undefined` is preserved so PATCH can distinguish "unchanged" from "clear".
 */
const identifierSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z
    .string()
    .regex(IDENTIFIER_PATTERN, IDENTIFIER_MESSAGE)
    .nullable()
    .optional()
);

export type UserProfile = {
  role: UserRole;
  npm: string | null;
  academicLevel: AcademicLevel | null;
  nip: string | null;
  nidn: string | null;
};

/** Validates the merged, resulting profile rather than a PATCH fragment. */
export function validateUserProfile(profile: UserProfile): string[] {
  const issues: string[] = [];

  if (profile.role === "mahasiswa") {
    if (!profile.npm || !profile.academicLevel) {
      issues.push("Mahasiswa wajib memiliki NPM dan jenjang pendidikan.");
    }
  } else if (profile.npm || profile.academicLevel) {
    issues.push("Admin/Dosen tidak boleh memiliki NPM dan jenjang pendidikan.");
  }

  if (profile.role !== "dosen" && (profile.nip || profile.nidn)) {
    issues.push(
      profile.role === "admin"
        ? "Admin tidak boleh memiliki NIP/NIDN."
        : "NIP/NIDN hanya untuk dosen."
    );
  }

  return issues;
}

const baseProfileFields = {
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.email("Email tidak valid"),
  major: z.string().trim().nullable().optional(),
  faculty: z.string().trim().nullable().optional(),
  bio: z.string().trim().nullable().optional(),
};

export const createUserSchema = z
  .object({
    ...baseProfileFields,
    password: z.string().min(6, "Password minimal 6 karakter"),
    role: z.enum(ROLES, "Peran wajib dipilih."),
    academicLevel: z.enum(ACADEMIC_LEVELS).nullable().optional(),
    npm: identifierSchema,
    nip: identifierSchema,
    nidn: identifierSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const message of validateUserProfile({
      role: data.role,
      npm: data.npm ?? null,
      academicLevel: data.academicLevel ?? null,
      nip: data.nip ?? null,
      nidn: data.nidn ?? null,
    })) {
      ctx.addIssue({ code: "custom", message });
    }
  });

/** Strict PATCH fragment. The service validates the merged profile. */
export const updateUserSchema = z
  .object({
    name: baseProfileFields.name.optional(),
    email: baseProfileFields.email.optional(),
    role: z.enum(ROLES, "Peran wajib dipilih.").optional(),
    academicLevel: z.enum(ACADEMIC_LEVELS).nullable().optional(),
    npm: identifierSchema,
    nip: identifierSchema,
    nidn: identifierSchema,
    major: baseProfileFields.major,
    faculty: baseProfileFields.faculty,
    bio: baseProfileFields.bio,
  })
  .strict();

export const userFilterSchema = z.object({
  role: z.enum(ROLES).optional(),
  academicLevel: z.enum(ACADEMIC_LEVELS).optional(),
  search: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserFilter = z.infer<typeof userFilterSchema>;
