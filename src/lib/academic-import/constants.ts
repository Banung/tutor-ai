import { z } from "zod/v4";

export const ACADEMIC_SOURCES = ["SIAT", "PIPP"] as const;
export type AcademicSourceValue = (typeof ACADEMIC_SOURCES)[number];

export const IMPORT_TYPES = ["STUDY_PROGRAMS", "COURSES", "LECTURERS"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // implementation of the 10 MB limit (10 MiB)
export const MAX_DATA_ROWS = 2000;
export const MAX_COLUMNS = 20;
export const MAX_CELL_CHARS = 4000;
export const PREVIEW_TTL_MS = 30 * 60 * 1000;
export const MAX_STAGING_BYTES = 8 * 1024 * 1024;

export const TEMPLATE_HEADERS: Record<ImportType, readonly string[]> = {
  STUDY_PROGRAMS: [
    "faculty_code",
    "faculty_name",
    "study_program_code",
    "study_program_name",
  ],
  COURSES: [
    "faculty_code",
    "study_program_code",
    "course_code",
    "course_name",
    "is_active",
  ],
  LECTURERS: ["nip", "nidn", "name", "email", "is_active"],
};

export const TEMPLATE_EXAMPLES: Record<ImportType, readonly (readonly (string | boolean)[])[]> = {
  STUDY_PROGRAMS: [
    ["FTIP", "Fakultas Teknologi Industri Pertanian", "TIP", "Teknologi Industri Pertanian"],
  ],
  COURSES: [["FTIP", "TIP", "TIP101", "Pengantar Teknologi Pertanian", true]],
  LECTURERS: [["1987654321", "0012345678", "Dr. Contoh Dosen", "dosen.contoh@example.ac.id", true]],
};

export const SOURCE_LABELS: Record<AcademicSourceValue, string> = {
  SIAT: "SIAT",
  PIPP: "PIPP",
};

const codePattern = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const courseCodePattern = /^[A-Z0-9]{4,12}$/;
const identifierPattern = /^[0-9]{8,18}$/;
const emailSchema = z.email();

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCode(value: string): boolean {
  return codePattern.test(value);
}

export function normalizeCourseCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCourseCode(value: string): boolean {
  return courseCodePattern.test(value);
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidName(value: string): boolean {
  return value.length >= 1 && value.length <= 150;
}

export function normalizeIdentifier(
  value: string
): { value: string | null; error: string | null } {
  const trimmed = value.trim();
  if (trimmed === "") return { value: null, error: null };
  if (!identifierPattern.test(trimmed)) {
    return {
      value: null,
      error: "NIP/NIDN harus berupa 8–18 digit angka.",
    };
  }
  return { value: trimmed, error: null };
}

export function normalizeEmail(
  value: string
): { value: string | null; error: string | null } {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") return { value: null, error: null };
  if (trimmed.length > 254 || !emailSchema.safeParse(trimmed).success) {
    return { value: null, error: "Email tidak valid." };
  }
  return { value: trimmed, error: null };
}

/** Strict documented booleans. Never uses JavaScript truthiness. */
export function normalizeActive(
  value: string | boolean
): { value: boolean | null; error: string | null } {
  if (typeof value === "boolean") return { value, error: null };
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return { value: true, error: null };
  if (normalized === "false") return { value: false, error: null };
  return { value: null, error: "is_active harus true atau false." };
}

/** Neutralizes spreadsheet formula injection in exported CSV cells. */
export function csvFormulaSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = csvFormulaSafe(text);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(toCsvValue).join(","), ...rows.map((row) => row.map(toCsvValue).join(","))]
    .join("\r\n")
    .concat("\r\n");
}
