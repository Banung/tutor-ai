import { z } from "zod/v4";

const courseCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{4,12}$/, "Format kode mata kuliah tidak valid (4–12 huruf/angka).")
  );

export const catalogStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** Shared with the lecturer creation route: intentionally has no admin catalog metadata. */
export const createCourseSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const adminCreateCourseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Nama mata kuliah wajib diisi.")
      .max(150, "Nama mata kuliah maksimal 150 karakter."),
    courseCode: courseCodeSchema,
    description: z.string().trim().nullable().optional(),
    learningOutcomes: z.string().trim().nullable().optional(),
    studyProgramId: z.string().trim().min(1).nullable().optional(),
    hasArModule: z.boolean().optional(),
  })
  .strict();

/** Generic admin PATCH. catalogStatus is deliberately not accepted; use the archive endpoint. */
export const updateCourseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Nama mata kuliah wajib diisi.")
      .max(150, "Nama mata kuliah maksimal 150 karakter.")
      .optional(),
    description: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
    courseCode: courseCodeSchema.optional(),
    learningOutcomes: z.string().trim().nullable().optional(),
    studyProgramId: z.string().trim().min(1).nullable().optional(),
    hasArModule: z.boolean().optional(),
  })
  .strict();

export const assignInstructorSchema = z.object({
  userId: z.string().min(1, "User ID wajib diisi"),
});

export const publicationActionSchema = z
  .object({
    action: z.enum(["publish", "unpublish"]),
  })
  .strict();

export type PublicationActionInput = z.infer<typeof publicationActionSchema>;

export const enrollStudentSchema = z.object({
  userId: z.string().min(1, "User ID wajib diisi"),
});

export const createFacultySchema = z
  .object({
    name: z.string().trim().min(1, "Nama fakultas wajib diisi.").max(150),
  })
  .strict();

export const createStudyProgramSchema = z
  .object({
    facultyId: z.string().trim().min(1, "Fakultas wajib dipilih."),
    name: z.string().trim().min(1, "Nama program studi wajib diisi.").max(150),
  })
  .strict();

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type AdminCreateCourseInput = z.infer<typeof adminCreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type AssignInstructorInput = z.infer<typeof assignInstructorSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type CatalogStatusInput = z.infer<typeof catalogStatusSchema>;
