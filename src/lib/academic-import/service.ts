import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  ACADEMIC_SOURCES,
  IMPORT_TYPES,
  MAX_STAGING_BYTES,
  PREVIEW_TTL_MS,
  TEMPLATE_HEADERS,
  buildCsv,
  isValidCode,
  isValidCourseCode,
  isValidName,
  normalizeActive,
  normalizeCode,
  normalizeCourseCode,
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  type AcademicSourceValue,
  type ImportType,
} from "./constants";
import { ImportFileError, parseImportFile, type RawCell } from "./file-parser";

export class AcademicImportError extends Error {
  constructor(message: string, readonly status = 400, readonly batchId?: string) {
    super(message);
    this.name = "AcademicImportError";
  }
}

export type PreviewAction = "CREATED" | "UPDATED" | "UNCHANGED" | "FAILED" | "CONFLICT";

type Value = string | boolean | null;
type Values = Record<string, Value>;
type TargetKind = "faculty" | "studyProgram" | "courseReference" | "lecturerReference";
type Target = { id: string; updatedAt: string };
type Targets = Partial<Record<TargetKind, Target>>;
const TARGET_ORDER: TargetKind[] = [
  "faculty",
  "studyProgram",
  "courseReference",
  "lecturerReference",
];

export type PreviewRow = {
  rowNumber: number;
  identity: string;
  action: PreviewAction;
  values: Values;
  /** Bounded raw cells as read from the file, aligned with template headers. */
  originalCells?: RawCell[];
  errors: string[];
  note?: string;
  targets: Targets;
  changes?: Record<string, { from: unknown; to: unknown }>;
};

type Classification = {
  action: PreviewAction;
  errors: string[];
  note?: string;
  targets: Targets;
  changes: Record<string, { from: unknown; to: unknown }>;
  /** Lecturer values with omitted identifiers filled from the existing record. */
  resolved?: Values;
};

function sourceConflict(
  existing: AcademicSourceValue | null | undefined,
  incoming: AcademicSourceValue
): string | null {
  return existing === "SIAT" && incoming === "PIPP"
    ? "Data ini dimiliki SIAT dan tidak dapat ditimpa oleh impor PIPP."
    : null;
}

function iso(date: Date): string {
  return date.toISOString();
}

function stringCell(cell: RawCell | undefined, label: string, errors: string[]): string {
  if (cell === undefined || cell === null) return "";
  if (typeof cell !== "string") {
    errors.push(`${label} harus berupa teks.`);
    return "";
  }
  return cell;
}

function activeCell(cell: RawCell | undefined, errors: string[]): boolean {
  if (typeof cell === "number") {
    errors.push("is_active harus berupa teks true/false atau sel boolean, bukan angka.");
    return true;
  }
  const parsed = normalizeActive(cell === undefined || cell === null ? "" : cell);
  if (parsed.error) errors.push(parsed.error);
  return parsed.value ?? true;
}

function normalizeCodeCell(
  cell: RawCell | undefined,
  label: string,
  kind: "code" | "course",
  errors: string[]
): string {
  const raw = stringCell(cell, label, errors);
  if (!raw.trim()) {
    errors.push(`${label} wajib diisi.`);
    return "";
  }
  const normalized = kind === "course" ? normalizeCourseCode(raw) : normalizeCode(raw);
  const valid = kind === "course" ? isValidCourseCode(normalized) : isValidCode(normalized);
  if (!valid) {
    errors.push(
      kind === "course"
        ? `${label} harus 4–12 huruf/angka.`
        : `${label} harus 2–20 huruf/angka, - atau _.`
    );
  }
  return normalized;
}

function normalizeNameCell(
  cell: RawCell | undefined,
  label: string,
  errors: string[]
): string {
  const raw = stringCell(cell, label, errors);
  const normalized = normalizeName(raw);
  if (!normalized) {
    errors.push(`${label} wajib diisi.`);
    return "";
  }
  if (!isValidName(normalized)) errors.push(`${label} maksimal 150 karakter.`);
  return normalized;
}

function normalizeImportRow(
  type: ImportType,
  cells: RawCell[]
): { values: Values; errors: string[]; identity: string } {
  const errors: string[] = [];

  if (type === "STUDY_PROGRAMS") {
    const values: Values = {
      facultyCode: normalizeCodeCell(cells[0], "faculty_code", "code", errors),
      facultyName: normalizeNameCell(cells[1], "faculty_name", errors),
      studyProgramCode: normalizeCodeCell(cells[2], "study_program_code", "code", errors),
      studyProgramName: normalizeNameCell(cells[3], "study_program_name", errors),
    };
    return {
      values,
      errors,
      identity: `FAC:${values.facultyCode}|PROG:${values.studyProgramCode}`,
    };
  }

  if (type === "COURSES") {
    const values: Values = {
      facultyCode: normalizeCodeCell(cells[0], "faculty_code", "code", errors),
      studyProgramCode: normalizeCodeCell(cells[1], "study_program_code", "code", errors),
      courseCode: normalizeCodeCell(cells[2], "course_code", "course", errors),
      courseName: normalizeNameCell(cells[3], "course_name", errors),
      isActive: activeCell(cells[4], errors),
    };
    return {
      values,
      errors,
      identity: `FAC:${values.facultyCode}|PROG:${values.studyProgramCode}|COURSE:${values.courseCode}`,
    };
  }

  const nip = normalizeIdentifier(stringCell(cells[0], "nip", errors));
  const nidn = normalizeIdentifier(stringCell(cells[1], "nidn", errors));
  if (nip.error) errors.push(nip.error);
  if (nidn.error) errors.push(nidn.error);
  if (!nip.value && !nidn.value) {
    errors.push("Isi minimal salah satu NIP atau NIDN.");
  }
  const email = normalizeEmail(stringCell(cells[3], "email", errors));
  if (email.error) errors.push(email.error);

  const values: Values = {
    nip: nip.value,
    nidn: nidn.value,
    name: normalizeNameCell(cells[2], "name", errors),
    email: email.value,
    isActive: activeCell(cells[4], errors),
  };
  return {
    values,
    errors,
    identity: `LECT:${values.nip ?? ""}|${values.nidn ?? ""}`,
  };
}

type FacultyRow = {
  id: string;
  name: string;
  code: string | null;
  source: AcademicSourceValue | null;
  updatedAt: Date;
};
type ProgramRow = FacultyRow & { facultyId: string };
type CourseRow = {
  id: string;
  name: string;
  isActive: boolean;
  source: AcademicSourceValue;
  updatedAt: Date;
};
type LecturerRow = {
  id: string;
  nip: string | null;
  nidn: string | null;
  name: string;
  email: string | null;
  isActive: boolean;
  source: AcademicSourceValue;
  updatedAt: Date;
};

async function classifyStudyProgram(
  db: Prisma.TransactionClient,
  source: AcademicSourceValue,
  values: Values
): Promise<Classification> {
  const errors: string[] = [];
  const changes: Classification["changes"] = {};
  const targets: Targets = {};
  const facultyCode = String(values.facultyCode);
  const facultyName = String(values.facultyName);
  const programCode = String(values.studyProgramCode);
  const programName = String(values.studyProgramName);

  let faculty: FacultyRow | null = await db.faculty.findUnique({
    where: { code: facultyCode },
    select: { id: true, name: true, code: true, source: true, updatedAt: true },
  });

  if (faculty) {
    if (faculty.name !== facultyName) {
      const nameClash = await db.faculty.findFirst({
        where: {
          name: { equals: facultyName, mode: "insensitive" },
          id: { not: faculty.id },
        },
        select: { id: true },
      });
      if (nameClash) {
        return {
          action: "CONFLICT",
          errors: ["Nama fakultas sudah dipakai fakultas lain dengan kode berbeda."],
          targets,
          changes,
        };
      }
      const conflict = sourceConflict(faculty.source, source);
      if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
      changes.facultyName = { from: faculty.name, to: facultyName };
    }
    if (source === "SIAT" && faculty.source !== "SIAT") {
      changes.facultySource = { from: faculty.source, to: "SIAT" };
    }
    targets.faculty = { id: faculty.id, updatedAt: iso(faculty.updatedAt) };
  } else {
    const byName = (await db.faculty.findMany({
      where: { name: { equals: facultyName, mode: "insensitive" } },
      select: { id: true, name: true, code: true, source: true, updatedAt: true },
    })) as FacultyRow[];
    if (byName.length > 1) {
      return {
        action: "CONFLICT",
        errors: ["Nama fakultas ambigu; tidak dapat diadopsi otomatis."],
        targets,
        changes,
      };
    }
    if (byName.length === 1) {
      const existing = byName[0];
      if (existing.code && existing.code !== facultyCode) {
        return {
          action: "CONFLICT",
          errors: [
            `Fakultas "${existing.name}" sudah memiliki kode ${existing.code}, bukan ${facultyCode}.`,
          ],
          targets,
          changes,
        };
      }
      const conflict = sourceConflict(existing.source, source);
      if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
      faculty = existing;
      targets.faculty = { id: existing.id, updatedAt: iso(existing.updatedAt) };
      if (!existing.code) {
        changes.facultyCode = { from: null, to: facultyCode };
        changes.facultyAdopted = { from: false, to: true };
      }
    }
  }

  let program: ProgramRow | null = null;
  if (faculty) {
    program = (await db.studyProgram.findFirst({
      where: { facultyId: faculty.id, code: programCode },
      select: {
        id: true,
        facultyId: true,
        name: true,
        code: true,
        source: true,
        updatedAt: true,
      },
    })) as ProgramRow | null;
  }

  if (!program && faculty) {
    const byName = (await db.studyProgram.findMany({
      where: {
        facultyId: faculty.id,
        name: { equals: programName, mode: "insensitive" },
      },
      select: {
        id: true,
        facultyId: true,
        name: true,
        code: true,
        source: true,
        updatedAt: true,
      },
    })) as ProgramRow[];
    if (byName.length > 1) {
      return {
        action: "CONFLICT",
        errors: ["Nama program studi ambigu; tidak dapat diadopsi otomatis."],
        targets,
        changes,
      };
    }
    if (byName.length === 1) {
      const existing = byName[0];
      if (existing.code && existing.code !== programCode) {
        return {
          action: "CONFLICT",
          errors: [
            `Program studi "${existing.name}" sudah memiliki kode ${existing.code}, bukan ${programCode}.`,
          ],
          targets,
          changes,
        };
      }
      const conflict = sourceConflict(existing.source, source);
      if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
      program = existing;
      if (!existing.code) {
        changes.studyProgramCode = { from: null, to: programCode };
        changes.studyProgramAdopted = { from: false, to: true };
      }
    }
  }

  if (program) {
    targets.studyProgram = { id: program.id, updatedAt: iso(program.updatedAt) };
    if (program.name !== programName) {
      const conflict = sourceConflict(program.source, source);
      if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
      changes.studyProgramName = { from: program.name, to: programName };
    }
    if (source === "SIAT" && program.source !== "SIAT") {
      changes.studyProgramSource = { from: program.source, to: "SIAT" };
    }
  }

  if (errors.length > 0) {
    return { action: "FAILED", errors, targets, changes };
  }
  if (!program) return { action: "CREATED", errors, targets, changes };
  if (Object.keys(changes).length > 0) return { action: "UPDATED", errors, targets, changes };
  return { action: "UNCHANGED", errors, targets, changes };
}

async function classifyCourse(
  db: Prisma.TransactionClient,
  source: AcademicSourceValue,
  values: Values
): Promise<Classification> {
  const facultyCode = String(values.facultyCode);
  const programCode = String(values.studyProgramCode);
  const courseCode = String(values.courseCode);
  const name = String(values.courseName);
  const isActive = Boolean(values.isActive);
  const changes: Classification["changes"] = {};
  const targets: Targets = {};

  const faculty = await db.faculty.findUnique({
    where: { code: facultyCode },
    select: { id: true },
  });
  if (!faculty) {
    return {
      action: "FAILED",
      errors: [`Fakultas dengan kode ${facultyCode} tidak ditemukan.`],
      targets,
      changes,
    };
  }
  const program = await db.studyProgram.findFirst({
    where: { facultyId: faculty.id, code: programCode },
    select: { id: true },
  });
  if (!program) {
    return {
      action: "FAILED",
      errors: [
        `Program studi ${programCode} pada fakultas ${facultyCode} belum ada. Impor program studi terlebih dahulu.`,
      ],
      targets,
      changes,
    };
  }

  const existing = (await db.academicCourseReference.findFirst({
    where: { studyProgramId: program.id, courseCode },
    select: { id: true, name: true, isActive: true, source: true, updatedAt: true },
  })) as CourseRow | null;

  if (!existing) return { action: "CREATED", errors: [], targets, changes };
  targets.courseReference = {
    id: existing.id,
    updatedAt: iso(existing.updatedAt),
  };
  if (existing.name !== name) changes.courseName = { from: existing.name, to: name };
  if (existing.isActive !== isActive) {
    changes.isActive = { from: existing.isActive, to: isActive };
  }
  if (source === "SIAT" && existing.source !== "SIAT") {
    changes.source = { from: existing.source, to: "SIAT" };
  }
  if (Object.keys(changes).length === 0) {
    return { action: "UNCHANGED", errors: [], targets, changes };
  }
  const conflict = sourceConflict(existing.source, source);
  if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
  return { action: "UPDATED", errors: [], targets, changes };
}

async function classifyLecturer(
  db: Prisma.TransactionClient,
  source: AcademicSourceValue,
  values: Values
): Promise<Classification> {
  const nip = values.nip === null ? null : String(values.nip);
  const nidn = values.nidn === null ? null : String(values.nidn);
  const name = String(values.name);
  const email = values.email === null ? null : String(values.email);
  const isActive = Boolean(values.isActive);
  const changes: Classification["changes"] = {};
  const targets: Targets = {};

  const identifiers = [
    ...(nip ? [{ nip }] : []),
    ...(nidn ? [{ nidn }] : []),
  ];
  const matches = (await db.lecturerReference.findMany({
    where: { OR: identifiers },
    select: {
      id: true,
      nip: true,
      nidn: true,
      name: true,
      email: true,
      isActive: true,
      source: true,
      updatedAt: true,
    },
  })) as LecturerRow[];

  if (matches.length > 1) {
    return {
      action: "FAILED",
      errors: ["NIP dan NIDN merujuk pada dua dosen berbeda."],
      targets,
      changes,
    };
  }

  const existing = matches[0] ?? null;
  if (!existing) return { action: "CREATED", errors: [], targets, changes };

  const errors: string[] = [];
  if (nip && existing.nip && existing.nip !== nip) {
    errors.push("NIP berbeda dari NIP yang sudah tercatat; tidak dapat diganti otomatis.");
  }
  if (nidn && existing.nidn && existing.nidn !== nidn) {
    errors.push("NIDN berbeda dari NIDN yang sudah tercatat; tidak dapat diganti otomatis.");
  }
  if (errors.length > 0) {
    return { action: "FAILED", errors, targets, changes };
  }

  targets.lecturerReference = {
    id: existing.id,
    updatedAt: iso(existing.updatedAt),
  };

  if (existing.name !== name) changes.name = { from: existing.name, to: name };
  if (existing.email !== email) changes.email = { from: existing.email, to: email };
  if (existing.isActive !== isActive) {
    changes.isActive = { from: existing.isActive, to: isActive };
  }
  if (nip && !existing.nip) changes.nip = { from: null, to: nip };
  if (nidn && !existing.nidn) changes.nidn = { from: null, to: nidn };
  if (source === "SIAT" && existing.source !== "SIAT") {
    changes.source = { from: existing.source, to: "SIAT" };
  }

  if (Object.keys(changes).length === 0) {
    return { action: "UNCHANGED", errors: [], targets, changes };
  }
  const conflict = sourceConflict(existing.source, source);
  if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
  return {
    action: "UPDATED",
    errors: [],
    targets,
    changes,
    resolved: {
      ...values,
      nip: nip ?? existing.nip,
      nidn: nidn ?? existing.nidn,
    },
  };
}

function classifyRow(
  db: Prisma.TransactionClient,
  type: ImportType,
  source: AcademicSourceValue,
  values: Values
): Promise<Classification> {
  if (type === "STUDY_PROGRAMS") return classifyStudyProgram(db, source, values);
  if (type === "COURSES") return classifyCourse(db, source, values);
  return classifyLecturer(db, source, values);
}

function targetKey(kind: TargetKind, id: string): string {
  return `${kind}:${id}`;
}

function targetsMatch(
  preview: Targets,
  current: Targets,
  confirmedTargets: Map<string, string>
): boolean {
  return (Object.keys(preview) as TargetKind[]).every((key) => {
    const left = preview[key];
    const right = current[key];
    if (!left || !right || left.id !== right.id) return false;
    if (left.updatedAt === right.updatedAt) return true;
    // A mismatch is only acceptable when this same batch produced the new state.
    return confirmedTargets.get(targetKey(key, left.id)) === right.updatedAt;
  });
}

function targetsCovered(locked: Targets[], candidate: Targets): boolean {
  return TARGET_ORDER.every((kind) => {
    const target = candidate[kind];
    if (!target) return true;
    return locked.some((entry) => entry[kind]?.id === target.id);
  });
}

function unconfirmedTargets(
  preview: Targets,
  current: Targets,
  confirmedTargets: Map<string, string>
): TargetKind[] {
  return TARGET_ORDER.filter((kind) => {
    const target = current[kind];
    if (!target) return false;
    if (preview[kind]?.id === target.id) return false;
    return !confirmedTargets.has(targetKey(kind, target.id));
  });
}

/** Locks every known target in one fixed order before authoritative classification. */
async function lockTargets(
  tx: Prisma.TransactionClient,
  targetsList: Targets[]
): Promise<void> {
  for (const kind of TARGET_ORDER) {
    const ids = [
      ...new Set(
        targetsList.flatMap((targets) => (targets[kind] ? [targets[kind]!.id] : []))
      ),
    ].sort();
    for (const id of ids) {
      if (kind === "faculty") {
        await tx.$queryRaw`SELECT "id" FROM "faculty" WHERE "id" = ${id} FOR UPDATE`;
      } else if (kind === "studyProgram") {
        await tx.$queryRaw`SELECT "id" FROM "study_program" WHERE "id" = ${id} FOR UPDATE`;
      } else if (kind === "courseReference") {
        await tx.$queryRaw`SELECT "id" FROM "academic_course_reference" WHERE "id" = ${id} FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "lecturer_reference" WHERE "id" = ${id} FOR UPDATE`;
      }
    }
  }
}

async function snapshotAppliedTargets(
  tx: Prisma.TransactionClient,
  applied: AppliedTargets
): Promise<Targets> {
  const snapshot: Targets = {};
  if (applied.faculty) {
    const row = await tx.faculty.findUnique({
      where: { id: applied.faculty },
      select: { updatedAt: true },
    });
    if (row) snapshot.faculty = { id: applied.faculty, updatedAt: iso(row.updatedAt) };
  }
  if (applied.studyProgram) {
    const row = await tx.studyProgram.findUnique({
      where: { id: applied.studyProgram },
      select: { updatedAt: true },
    });
    if (row) {
      snapshot.studyProgram = { id: applied.studyProgram, updatedAt: iso(row.updatedAt) };
    }
  }
  if (applied.courseReference) {
    const row = await tx.academicCourseReference.findUnique({
      where: { id: applied.courseReference },
      select: { updatedAt: true },
    });
    if (row) {
      snapshot.courseReference = {
        id: applied.courseReference,
        updatedAt: iso(row.updatedAt),
      };
    }
  }
  if (applied.lecturerReference) {
    const row = await tx.lecturerReference.findUnique({
      where: { id: applied.lecturerReference },
      select: { updatedAt: true },
    });
    if (row) {
      snapshot.lecturerReference = {
        id: applied.lecturerReference,
        updatedAt: iso(row.updatedAt),
      };
    }
  }
  return snapshot;
}

function failRows(rows: PreviewRow[], message: string): void {
  for (const row of rows) {
    row.action = "FAILED";
    row.errors = [message];
    row.targets = {};
    row.changes = undefined;
  }
}

function validateSharedFaculty(rows: PreviewRow[]): void {
  const groups = new Map<string, PreviewRow[]>();
  for (const row of rows) {
    if (row.errors.length > 0) continue;
    const code = String(row.values.facultyCode ?? "");
    if (!code) continue;
    const group = groups.get(code) ?? [];
    group.push(row);
    groups.set(code, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const names = new Set(group.map((row) => String(row.values.facultyName ?? "")));
    if (names.size > 1) {
      failRows(
        group,
        "Baris untuk fakultas yang sama memiliki nama fakultas berbeda; perbaiki file."
      );
    }
  }
}

function validateLecturerIdentities(rows: PreviewRow[]): void {
  const candidates = rows.filter((row) => row.errors.length === 0);
  const parent = candidates.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) current = parent[current];
    return current;
  };
  const union = (left: number, right: number): void => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  const seen = new Map<string, number>();
  candidates.forEach((row, index) => {
    for (const key of ["nip", "nidn"] as const) {
      const value = row.values[key];
      if (value === null || value === "") continue;
      const token = `${key}:${String(value)}`;
      const first = seen.get(token);
      if (first === undefined) seen.set(token, index);
      else union(first, index);
    }
  });

  const components = new Map<number, PreviewRow[]>();
  candidates.forEach((row, index) => {
    const root = find(index);
    const group = components.get(root) ?? [];
    group.push(row);
    components.set(root, group);
  });

  for (const group of components.values()) {
    if (group.length < 2) continue;
    const nips = new Set(
      group.map((row) => row.values.nip).filter((value): value is string => !!value)
    );
    const nidns = new Set(
      group.map((row) => row.values.nidn).filter((value): value is string => !!value)
    );
    if (nips.size > 1 || nidns.size > 1) {
      failRows(
        group,
        "Baris dosen berbagi NIP/NIDN tetapi identitasnya saling bertentangan; perbaiki file."
      );
      continue;
    }

    // Merge an omitted identifier from the other rows of the same identity.
    const nip = nips.values().next().value ?? null;
    const nidn = nidns.values().next().value ?? null;
    for (const row of group) {
      row.values.nip = row.values.nip ?? nip;
      row.values.nidn = row.values.nidn ?? nidn;
      row.identity = `LECT:${row.values.nip ?? ""}|${row.values.nidn ?? ""}`;
    }

    const profiles = new Set(
      group.map((row) =>
        JSON.stringify({
          name: row.values.name,
          email: row.values.email,
          isActive: row.values.isActive,
        })
      )
    );
    if (profiles.size > 1) {
      failRows(
        group,
        "Baris dosen dengan identitas sama memiliki nama/email/status berbeda; perbaiki file."
      );
    }
  }
}

/** Reclassifies rows after in-file identity merging so stored state matches final input. */
async function reclassifyRows(
  rows: PreviewRow[],
  type: ImportType,
  source: AcademicSourceValue
): Promise<void> {
  for (const row of rows) {
    if (row.errors.length > 0) continue;
    const classified = await classifyRow(
      prisma as unknown as Prisma.TransactionClient,
      type,
      source,
      row.values
    );
    row.action = classified.action;
    row.errors = classified.errors;
    row.note = classified.note;
    row.targets = classified.targets;
    row.changes = classified.changes;
  }
}

function groupDuplicates(rows: PreviewRow[]): void {
  const groups = new Map<string, PreviewRow[]>();
  for (const row of rows) {
    if (row.errors.length > 0) continue;
    const group = groups.get(row.identity) ?? [];
    group.push(row);
    groups.set(row.identity, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    const identical = group.every(
      (row) => JSON.stringify(row.values) === JSON.stringify(first.values)
    );
    if (!identical) {
      for (const row of group) {
        row.action = "FAILED";
        row.errors = [
          "Baris duplikat dengan nilai berbeda untuk identitas yang sama; perbaiki file.",
        ];
        row.targets = {};
      }
      continue;
    }
    const firstFailed = first.action === "FAILED" || first.action === "CONFLICT";
    for (const row of group.slice(1)) {
      row.action = firstFailed ? "FAILED" : "UNCHANGED";
      row.errors = firstFailed ? ["Duplikat mengikuti baris pertama yang gagal."] : [];
      row.note = firstFailed
        ? undefined
        : "Baris duplikat identik diabaikan agar tidak menggandakan data.";
      row.targets = {};
      row.changes = undefined;
    }
  }
}

function countActions(rows: PreviewRow[]) {
  return {
    total: rows.length,
    created: rows.filter((row) => row.action === "CREATED").length,
    updated: rows.filter((row) => row.action === "UPDATED").length,
    unchanged: rows.filter((row) => row.action === "UNCHANGED").length,
    failed: rows.filter((row) => row.action === "FAILED").length,
    conflict: rows.filter((row) => row.action === "CONFLICT").length,
  };
}

export type ImportCounts = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  conflict: number;
};

export type ImportBatchOutcomeDto = {
  rowNumber: number;
  identity: string;
  action: PreviewAction;
  message: string | null;
};

export type ImportBatchDto = {
  id: string;
  source: AcademicSourceValue;
  type: ImportType;
  fileName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  previewCounts: ImportCounts & { columns: string[] };
  resultCounts: ImportCounts | null;
  rows: PreviewRow[];
  outcomes: ImportBatchOutcomeDto[];
  canConfirm: boolean;
};

type BatchLike = {
  id: string;
  source: string;
  type: string;
  fileName: string;
  status: string;
  summary: unknown;
  rows: unknown;
  expiresAt: Date;
  createdAt: Date;
  confirmedAt: Date | null;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  conflictCount: number;
  outcomes?: Array<{
    rowNumber: number;
    identity: string;
    action: string;
    message: string | null;
  }>;
};

export function toImportBatchDto(batch: BatchLike): ImportBatchDto {
  const summary = (batch.summary ?? {}) as Record<string, unknown>;
  const number = (key: string) => (typeof summary[key] === "number" ? (summary[key] as number) : 0);
  const columns = Array.isArray(summary.columns)
    ? summary.columns.filter((value): value is string => typeof value === "string")
    : [];
  const previewCounts = {
    total: number("total"),
    created: number("created"),
    updated: number("updated"),
    unchanged: number("unchanged"),
    failed: number("failed"),
    conflict: number("conflict"),
    columns,
  };
  const resultCounts = batch.confirmedAt
    ? {
        total:
          batch.createdCount +
          batch.updatedCount +
          batch.unchangedCount +
          batch.failedCount +
          batch.conflictCount,
        created: batch.createdCount,
        updated: batch.updatedCount,
        unchanged: batch.unchangedCount,
        failed: batch.failedCount,
        conflict: batch.conflictCount,
      }
    : null;

  return {
    id: batch.id,
    source: batch.source as AcademicSourceValue,
    type: batch.type as ImportType,
    fileName: batch.fileName,
    status: batch.status,
    expiresAt: batch.expiresAt.toISOString(),
    createdAt: batch.createdAt.toISOString(),
    confirmedAt: batch.confirmedAt ? batch.confirmedAt.toISOString() : null,
    previewCounts,
    resultCounts,
    rows: batch.rows as PreviewRow[],
    outcomes: (batch.outcomes ?? []).map((outcome) => ({
      rowNumber: outcome.rowNumber,
      identity: outcome.identity,
      action: outcome.action as PreviewAction,
      message: outcome.message,
    })),
    canConfirm:
      batch.status === "PREVIEWED" &&
      batch.expiresAt.getTime() > Date.now() &&
      previewCounts.created + previewCounts.updated + previewCounts.unchanged > 0,
  };
}

export async function previewImport(input: {
  buffer: Buffer;
  fileName: string;
  source: AcademicSourceValue;
  type: ImportType;
  actorId: string;
}) {
  const parsed = await parseImportFile(input.buffer, input.fileName, input.type);
  const headers = TEMPLATE_HEADERS[input.type];

  const rows: PreviewRow[] = [];
  for (const raw of parsed.rows) {
    const normalized = normalizeImportRow(input.type, raw.cells);
    if (normalized.errors.length > 0) {
      rows.push({
        rowNumber: raw.rowNumber,
        identity: normalized.identity,
        action: "FAILED",
        values: normalized.values,
        originalCells: raw.cells,
        errors: normalized.errors,
        targets: {},
      });
      continue;
    }
    const classified = await classifyRow(
      prisma as unknown as Prisma.TransactionClient,
      input.type,
      input.source,
      normalized.values
    );
    rows.push({
      rowNumber: raw.rowNumber,
      identity: normalized.identity,
      action: classified.action,
      values: normalized.values,
      originalCells: raw.cells,
      errors: classified.errors,
      note: classified.note,
      targets: classified.targets,
      changes: classified.changes,
    });
  }

  if (input.type === "STUDY_PROGRAMS") validateSharedFaculty(rows);
  if (input.type === "LECTURERS") {
    validateLecturerIdentities(rows);
    await reclassifyRows(rows, input.type, input.source);
  }
  groupDuplicates(rows);
  const summary = { ...countActions(rows), columns: [...headers] };

  if (Buffer.byteLength(JSON.stringify(rows)) > MAX_STAGING_BYTES) {
    throw new ImportFileError("Data pratinjau terlalu besar; pecah berkas menjadi beberapa impor.");
  }

  const batch = await prisma.academicImportBatch.create({
    data: {
      id: crypto.randomUUID(),
      actorId: input.actorId,
      source: input.source,
      type: input.type,
      fileName: input.fileName.replace(/[\\/]/g, "_").slice(0, 200),
      fileDigest: parsed.digest,
      status: "PREVIEWED",
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
      summary,
      rows: rows as unknown as Prisma.InputJsonValue,
      createdCount: summary.created,
      updatedCount: summary.updated,
      unchangedCount: summary.unchanged,
      failedCount: summary.failed,
      conflictCount: summary.conflict,
    },
  });

  return toImportBatchDto(batch);
}

type AppliedTargets = Partial<Record<TargetKind, string>>;

async function applyClassified(
  tx: Prisma.TransactionClient,
  type: ImportType,
  source: AcademicSourceValue,
  values: Values,
  classified: Classification
): Promise<AppliedTargets> {
  if (type === "STUDY_PROGRAMS") {
    const facultyCode = String(values.facultyCode);
    const facultyName = String(values.facultyName);
    const programCode = String(values.studyProgramCode);
    const programName = String(values.studyProgramName);
    let facultyId = classified.targets.faculty?.id ?? null;
    if (facultyId) {
      const facultyData: Record<string, string> = {};
      if (classified.changes.facultyName) facultyData.name = facultyName;
      if (classified.changes.facultyCode) facultyData.code = facultyCode;
      if (classified.changes.facultySource) facultyData.source = source;
      if (Object.keys(facultyData).length > 0) {
        await tx.faculty.update({ where: { id: facultyId }, data: facultyData });
      }
    } else {
      const faculty = await tx.faculty.create({
        data: {
          id: crypto.randomUUID(),
          name: facultyName,
          code: facultyCode,
          source,
        },
        select: { id: true },
      });
      facultyId = faculty.id;
    }

    const programData: Record<string, string> = {};
    if (classified.changes.studyProgramName) programData.name = programName;
    if (classified.changes.studyProgramCode) programData.code = programCode;
    if (classified.changes.studyProgramSource) programData.source = source;
    const programId = classified.targets.studyProgram?.id ?? null;
    if (programId) {
      if (Object.keys(programData).length > 0) {
        await tx.studyProgram.update({ where: { id: programId }, data: programData });
      }
      return { faculty: facultyId, studyProgram: programId };
    }
    const program = await tx.studyProgram.create({
      data: {
        id: crypto.randomUUID(),
        facultyId,
        name: programName,
        code: programCode,
        source,
      },
      select: { id: true },
    });
    return { faculty: facultyId, studyProgram: program.id };
  }

  if (type === "COURSES") {
    const facultyCode = String(values.facultyCode);
    const programCode = String(values.studyProgramCode);
    const courseCode = String(values.courseCode);
    const faculty = await tx.faculty.findUnique({
      where: { code: facultyCode },
      select: { id: true },
    });
    if (!faculty) throw new Error("Fakultas hilang saat konfirmasi.");
    const program = await tx.studyProgram.findFirst({
      where: { facultyId: faculty.id, code: programCode },
      select: { id: true },
    });
    if (!program) throw new Error("Program studi hilang saat konfirmasi.");

    const targetId = classified.targets.courseReference?.id ?? null;
    if (targetId) {
      const data: Record<string, string | boolean | AcademicSourceValue> = {};
      if (classified.changes.courseName) data.name = String(values.courseName);
      if (classified.changes.isActive) data.isActive = Boolean(values.isActive);
      if (classified.changes.source) data.source = source;
      if (Object.keys(data).length > 0) {
        await tx.academicCourseReference.update({ where: { id: targetId }, data });
      }
      return { courseReference: targetId };
    }
    const created = await tx.academicCourseReference.create({
      data: {
        id: crypto.randomUUID(),
        studyProgramId: program.id,
        courseCode,
        name: String(values.courseName),
        isActive: Boolean(values.isActive),
        source,
      },
      select: { id: true },
    });
    return { courseReference: created.id };
  }

  const resolved = classified.resolved ?? values;
  const nip = resolved.nip === null ? null : String(resolved.nip);
  const nidn = resolved.nidn === null ? null : String(resolved.nidn);
  const data = {
    nip,
    nidn,
    name: String(resolved.name),
    email: resolved.email === null ? null : String(resolved.email),
    isActive: Boolean(resolved.isActive),
    source,
  };
  const targetId = classified.targets.lecturerReference?.id ?? null;
  if (targetId) {
    await tx.lecturerReference.update({ where: { id: targetId }, data });
    return { lecturerReference: targetId };
  }
  const created = await tx.lecturerReference.create({
    data: { id: crypto.randomUUID(), ...data },
    select: { id: true },
  });
  return { lecturerReference: created.id };
}

async function recordOutcome(
  tx: Prisma.TransactionClient,
  batchId: string,
  row: PreviewRow,
  action: PreviewRow["action"],
  message: string | null
): Promise<void> {
  await tx.academicImportRowOutcome.create({
    data: {
      id: crypto.randomUUID(),
      batchId,
      rowNumber: row.rowNumber,
      identity: row.identity,
      action,
      message,
      data: row.values,
    },
  });
}

export async function confirmImport(batchId: string, actorId: string) {
  type Claim =
    | { kind: "claimed"; batch: NonNullable<Awaited<ReturnType<typeof prisma.academicImportBatch.findUnique>>> }
    | { kind: "stored" }
    | { kind: "expired" };

  let claim: Claim;
  try {
    claim = await prisma.$transaction(async (tx) => {
      const actorRows = await tx.$queryRaw<Array<{ id: string; role: string }>>`
        SELECT "id", "role" FROM "user" WHERE "id" = ${actorId} FOR UPDATE
      `;
      if (actorRows.length === 0 || actorRows[0].role !== "admin") {
        throw new AcademicImportError("Akses admin diperlukan.", 403);
      }

      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "academic_import_batch" WHERE "id" = ${batchId} FOR UPDATE
      `;
      if (rows.length === 0) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);
      const batch = await tx.academicImportBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);

      if (batch.actorId !== actorId) {
        throw new AcademicImportError(
          "Hanya pembuat pratinjau yang dapat mengonfirmasi batch ini. Buat pratinjau sendiri.",
          403,
          batchId
        );
      }
      if (batch.status === "CONFIRMED" || batch.status === "PARTIAL") {
        return { kind: "stored" };
      }
      if (batch.status === "CONFIRMING") {
        throw new AcademicImportError(
          "Batch sedang dikonfirmasi. Muat status batch, jangan mulai impor baru.",
          409,
          batchId
        );
      }
      if (batch.status !== "PREVIEWED") {
        throw new AcademicImportError("Batch tidak dapat dikonfirmasi.", 409, batchId);
      }
      if (batch.expiresAt.getTime() <= Date.now()) {
        return { kind: "expired" };
      }
      await tx.academicImportBatch.update({
        where: { id: batchId },
        data: { status: "CONFIRMING" },
      });
      return { kind: "claimed", batch };
    });
  } catch (error) {
    if (error instanceof AcademicImportError) throw error;
    throw new AcademicImportError("Gagal memulai konfirmasi.", 500, batchId);
  }

  if (claim.kind === "stored") {
    return getBatch(batchId);
  }
  if (claim.kind === "expired") {
    // Commit the EXPIRED state in its own transaction; never roll it back by throwing.
    await prisma.academicImportBatch.updateMany({
      where: { id: batchId, status: "PREVIEWED", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    throw new AcademicImportError(
      "Pratinjau kedaluwarsa. Buat pratinjau baru.",
      409,
      batchId
    );
  }

  const batch = claim.batch;
  const rows = batch.rows as unknown as PreviewRow[];
  const confirmedTargets = new Map<string, string>();
  let authorityRevoked = false;

  for (const row of rows) {
    if (row.action === "FAILED" || row.action === "CONFLICT") {
      await bestEffortOutcome(batchId, row, row.action, row.errors.join(" ") || null);
      continue;
    }
    if (authorityRevoked) {
      await bestEffortOutcome(
        batchId,
        row,
        "FAILED",
        "Otoritas admin dicabut sebelum baris ini diproses; tidak ada perubahan yang diterapkan."
      );
      continue;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const actorRows = await tx.$queryRaw<Array<{ id: string; role: string }>>`
          SELECT "id", "role" FROM "user" WHERE "id" = ${actorId} FOR UPDATE
        `;
        if (actorRows.length === 0 || actorRows[0].role !== "admin") {
          return { revoked: true as const };
        }

        if (row.action === "UNCHANGED" && Object.keys(row.targets).length === 0) {
          // Identical duplicate row: intentionally skipped, not re-resolved.
          await recordOutcome(tx, batchId, row, "UNCHANGED", row.note ?? null);
          return { revoked: false as const };
        }

        const lockedTargets: Targets[] = [row.targets];
        await lockTargets(tx, lockedTargets);
        let classified = await classifyRow(
          tx,
          batch.type as ImportType,
          batch.source as AcademicSourceValue,
          row.values
        );
        let locksCovered = targetsCovered(lockedTargets, classified.targets);
        for (let attempt = 0; attempt < 3 && !locksCovered; attempt += 1) {
          lockedTargets.push(classified.targets);
          await lockTargets(tx, [classified.targets]);
          classified = await classifyRow(
            tx,
            batch.type as ImportType,
            batch.source as AcademicSourceValue,
            row.values
          );
          locksCovered = targetsCovered(lockedTargets, classified.targets);
        }
        if (!locksCovered) {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Target terus berubah saat konfirmasi. Buat pratinjau baru."
          );
          return { revoked: false as const };
        }

        if (unconfirmedTargets(row.targets, classified.targets, confirmedTargets).length > 0) {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Target baru muncul sejak pratinjau dan tidak berasal dari batch ini. Buat pratinjau baru."
          );
          return { revoked: false as const };
        }
        if (!targetsMatch(row.targets, classified.targets, confirmedTargets)) {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Data berubah sejak pratinjau. Buat pratinjau baru sebelum mengonfirmasi."
          );
          return { revoked: false as const };
        }

        if (row.action === "UNCHANGED") {
          await recordOutcome(tx, batchId, row, "UNCHANGED", row.note ?? null);
          return { revoked: false as const };
        }

        if (row.action === "CREATED" && classified.action !== "CREATED") {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Identitas sudah berubah sejak pratinjau. Buat pratinjau baru."
          );
          return { revoked: false as const };
        }
        if (row.action === "UPDATED" && classified.action === "UNCHANGED") {
          await recordOutcome(
            tx,
            batchId,
            row,
            "UNCHANGED",
            "Perubahan sudah dipenuhi baris sebelumnya dalam batch ini; tidak ada penulisan tambahan."
          );
          return { revoked: false as const };
        }
        if (row.action === "UPDATED" && classified.action !== "UPDATED") {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Data berubah sejak pratinjau. Buat pratinjau baru."
          );
          return { revoked: false as const };
        }
        if (row.action !== "CREATED" && row.action !== "UPDATED") {
          await recordOutcome(tx, batchId, row, "FAILED", "Status baris tidak dikenal.");
          return { revoked: false as const };
        }

        const applied = await applyClassified(
          tx,
          batch.type as ImportType,
          batch.source as AcademicSourceValue,
          row.values,
          classified
        );
        const snapshot = await snapshotAppliedTargets(tx, applied);
        await recordOutcome(tx, batchId, row, row.action, null);
        return { revoked: false as const, snapshot };
      }, { timeout: 30000, maxWait: 10000 });

      if (result.revoked) {
        authorityRevoked = true;
        await bestEffortOutcome(
          batchId,
          row,
          "FAILED",
          "Otoritas admin dicabut sebelum baris ini diproses; tidak ada perubahan yang diterapkan."
        );
        continue;
      }
      if (result.snapshot) {
        for (const [kind, target] of Object.entries(result.snapshot)) {
          confirmedTargets.set(targetKey(kind as TargetKind, target.id), target.updatedAt);
        }
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message =
        code === "P2002"
          ? "Konflik identitas unik saat konfirmasi. Buat pratinjau baru."
          : "Baris gagal diproses; baris lain yang sudah commit tetap tersimpan.";
      await bestEffortOutcome(batchId, row, "FAILED", message);
    }
  }

  const outcomes = await prisma.academicImportRowOutcome.findMany({
    where: { batchId },
    select: { action: true },
  });
  const counts = {
    created: outcomes.filter((row) => row.action === "CREATED").length,
    updated: outcomes.filter((row) => row.action === "UPDATED").length,
    unchanged: outcomes.filter((row) => row.action === "UNCHANGED").length,
    failed: outcomes.filter((row) => row.action === "FAILED").length,
    conflict: outcomes.filter((row) => row.action === "CONFLICT").length,
  };

  try {
    await prisma.academicImportBatch.update({
      where: { id: batchId },
      data: {
        status: counts.failed + counts.conflict > 0 ? "PARTIAL" : "CONFIRMED",
        confirmedAt: new Date(),
        createdCount: counts.created,
        updatedCount: counts.updated,
        unchangedCount: counts.unchanged,
        failedCount: counts.failed,
        conflictCount: counts.conflict,
        summary: {
          ...(batch.summary as Record<string, unknown>),
          result: counts,
        },
      },
    });
  } catch {
    throw new AcademicImportError(
      "Sebagian baris sudah diproses, tetapi ringkasan batch gagal disimpan. Muat status batch sebelum mencoba lagi.",
      500,
      batchId
    );
  }

  return getBatch(batchId);
}

async function bestEffortOutcome(
  batchId: string,
  row: PreviewRow,
  action: PreviewRow["action"],
  message: string | null
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await recordOutcome(tx, batchId, row, action, message);
    }, { timeout: 15000 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
}

export async function listBatches() {
  return prisma.academicImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      source: true,
      type: true,
      fileName: true,
      status: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      failedCount: true,
      conflictCount: true,
      createdAt: true,
      confirmedAt: true,
      expiresAt: true,
    },
  });
}

export async function getBatch(batchId: string) {
  const batch = await prisma.academicImportBatch.findUnique({
    where: { id: batchId },
    include: { outcomes: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);
  return toImportBatchDto(batch);
}

function valueKey(type: ImportType, header: string): string | undefined {
  const maps: Record<ImportType, Record<string, string>> = {
    STUDY_PROGRAMS: {
      faculty_code: "facultyCode",
      faculty_name: "facultyName",
      study_program_code: "studyProgramCode",
      study_program_name: "studyProgramName",
    },
    COURSES: {
      faculty_code: "facultyCode",
      study_program_code: "studyProgramCode",
      course_code: "courseCode",
      course_name: "courseName",
      is_active: "isActive",
    },
    LECTURERS: {
      nip: "nip",
      nidn: "nidn",
      name: "name",
      email: "email",
      is_active: "isActive",
    },
  };
  return maps[type][header];
}

function rawCellText(cell: RawCell | undefined): string {
  return cell === null || cell === undefined ? "" : String(cell);
}

export async function failedRowsCsv(batchId: string) {
  const batch = await getBatch(batchId);
  const rows = batch.rows;
  const byRow = new Map(rows.map((row) => [row.rowNumber, row]));
  const headers = TEMPLATE_HEADERS[batch.type];

  const originalValues = (row: PreviewRow | undefined): string[] => {
    if (!row) return headers.map(() => "");
    if (row.originalCells && row.originalCells.length > 0) {
      return headers.map((_, index) => rawCellText(row.originalCells?.[index]));
    }
    // Legacy batches stored no original cells: fall back to normalized values.
    return headers.map((header) => {
      const key = valueKey(batch.type, header);
      return key ? rawCellText(row.values[key]) : "";
    });
  };

  const entries =
    batch.outcomes.length > 0
      ? batch.outcomes
          .filter((outcome) => outcome.action === "FAILED" || outcome.action === "CONFLICT")
          .map((outcome) => ({
            rowNumber: outcome.rowNumber,
            identity: outcome.identity,
            message: outcome.message ?? "",
            row: byRow.get(outcome.rowNumber),
          }))
      : rows
          .filter((row) => row.action === "FAILED" || row.action === "CONFLICT")
          .map((row) => ({
            rowNumber: row.rowNumber,
            identity: row.identity,
            message: row.errors.join(" ") || row.note || "",
            row,
          }));

  const reportRows = entries.map((entry) => [
    entry.rowNumber,
    entry.message,
    entry.identity,
    ...originalValues(entry.row),
  ]);

  return buildCsv(["row_number", "error", "identity", ...headers], reportRows);
}

export function isImportType(value: string): value is ImportType {
  return (IMPORT_TYPES as readonly string[]).includes(value);
}

export function isAcademicSource(value: string): value is AcademicSourceValue {
  return (ACADEMIC_SOURCES as readonly string[]).includes(value);
}
