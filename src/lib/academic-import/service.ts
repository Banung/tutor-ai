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

export type PreviewRow = {
  rowNumber: number;
  identity: string;
  action: PreviewAction;
  values: Values;
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

  if (Object.keys(changes).length === 0) {
    return { action: "UNCHANGED", errors: [], targets, changes };
  }
  const conflict = sourceConflict(existing.source, source);
  if (conflict) return { action: "CONFLICT", errors: [conflict], targets, changes };
  return { action: "UPDATED", errors: [], targets, changes };
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

function targetsMatch(preview: Targets, current: Targets): boolean {
  return (Object.keys(preview) as TargetKind[]).every((key) => {
    const left = preview[key];
    const right = current[key];
    return !!left && !!right && left.id === right.id && left.updatedAt === right.updatedAt;
  });
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
      errors: classified.errors,
      note: classified.note,
      targets: classified.targets,
      changes: classified.changes,
    });
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

  return {
    id: batch.id,
    batchId: batch.id,
    source: batch.source,
    type: batch.type,
    expiresAt: batch.expiresAt,
    summary,
    rows,
  };
}

async function applyClassified(
  tx: Prisma.TransactionClient,
  type: ImportType,
  source: AcademicSourceValue,
  values: Values,
  classified: Classification
): Promise<void> {
  if (type === "STUDY_PROGRAMS") {
    const facultyCode = String(values.facultyCode);
    const facultyName = String(values.facultyName);
    const programCode = String(values.studyProgramCode);
    const programName = String(values.studyProgramName);
    let facultyId = classified.targets.faculty?.id ?? null;
    if (facultyId) {
      if (classified.changes.facultyName || classified.changes.facultyCode) {
        await tx.faculty.update({
          where: { id: facultyId },
          data: { name: facultyName, code: facultyCode, source },
        });
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

    if (classified.targets.studyProgram?.id) {
      await tx.studyProgram.update({
        where: { id: classified.targets.studyProgram.id },
        data: { name: programName, code: programCode, source },
      });
    } else {
      await tx.studyProgram.create({
        data: {
          id: crypto.randomUUID(),
          facultyId,
          name: programName,
          code: programCode,
          source,
        },
      });
    }
    return;
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

    if (classified.targets.courseReference?.id) {
      await tx.academicCourseReference.update({
        where: { id: classified.targets.courseReference.id },
        data: {
          name: String(values.courseName),
          isActive: Boolean(values.isActive),
          source,
        },
      });
    } else {
      await tx.academicCourseReference.create({
        data: {
          id: crypto.randomUUID(),
          studyProgramId: program.id,
          courseCode,
          name: String(values.courseName),
          isActive: Boolean(values.isActive),
          source,
        },
      });
    }
    return;
  }

  const nip = values.nip === null ? null : String(values.nip);
  const nidn = values.nidn === null ? null : String(values.nidn);
  const data = {
    nip,
    nidn,
    name: String(values.name),
    email: values.email === null ? null : String(values.email),
    isActive: Boolean(values.isActive),
    source,
  };
  if (classified.targets.lecturerReference?.id) {
    await tx.lecturerReference.update({
      where: { id: classified.targets.lecturerReference.id },
      data,
    });
  } else {
    await tx.lecturerReference.create({
      data: { id: crypto.randomUUID(), ...data },
    });
  }
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
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true },
  });
  if (!actor || actor.role !== "admin") {
    throw new AcademicImportError("Akses admin diperlukan.", 403);
  }

  let claimed = false;
  let existingBatch = null as Awaited<ReturnType<typeof prisma.academicImportBatch.findUnique>>;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "academic_import_batch" WHERE "id" = ${batchId} FOR UPDATE
      `;
      if (rows.length === 0) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);
      const batch = await tx.academicImportBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);
      existingBatch = batch;

      if (batch.status === "CONFIRMED" || batch.status === "PARTIAL") {
        return false;
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
        await tx.academicImportBatch.update({
          where: { id: batchId },
          data: { status: "EXPIRED" },
        });
        throw new AcademicImportError(
          "Pratinjau kedaluwarsa. Buat pratinjau baru.",
          409,
          batchId
        );
      }
      await tx.academicImportBatch.update({
        where: { id: batchId },
        data: { status: "CONFIRMING" },
      });
      return true;
    });
  } catch (error) {
    if (error instanceof AcademicImportError) throw error;
    throw new AcademicImportError("Gagal memulai konfirmasi.", 500, batchId);
  }

  if (!claimed) {
    return getBatch(batchId);
  }

  const batch = existingBatch;
  if (!batch) throw new AcademicImportError("Batch impor tidak ditemukan.", 404);
  const rows = batch.rows as unknown as PreviewRow[];

  for (const row of rows) {
    if (row.action === "FAILED" || row.action === "CONFLICT") {
      await bestEffortOutcome(batchId, row, row.action, row.errors.join(" ") || null);
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (row.action === "UNCHANGED" && Object.keys(row.targets).length === 0) {
          // Identical duplicate row: intentionally skipped, not re-resolved.
          await recordOutcome(tx, batchId, row, "UNCHANGED", row.note ?? null);
          return;
        }

        const classified = await classifyRow(
          tx,
          batch.type as ImportType,
          batch.source as AcademicSourceValue,
          row.values
        );
        if (!targetsMatch(row.targets, classified.targets)) {
          await recordOutcome(
            tx,
            batchId,
            row,
            "FAILED",
            "Data berubah sejak pratinjau. Buat pratinjau baru sebelum mengonfirmasi."
          );
          return;
        }

        if (row.action === "UNCHANGED") {
          await recordOutcome(tx, batchId, row, "UNCHANGED", row.note ?? null);
          return;
        }

        if (row.action === "CREATED") {
          if (classified.action !== "CREATED") {
            await recordOutcome(
              tx,
              batchId,
              row,
              "FAILED",
              "Identitas sudah berubah sejak pratinjau. Buat pratinjau baru."
            );
            return;
          }
          await applyClassified(tx, batch.type as ImportType, batch.source as AcademicSourceValue, row.values, classified);
          await recordOutcome(tx, batchId, row, "CREATED", null);
          return;
        }

        if (row.action === "UPDATED") {
          if (classified.action !== "UPDATED") {
            await recordOutcome(
              tx,
              batchId,
              row,
              "FAILED",
              "Data berubah sejak pratinjau. Buat pratinjau baru."
            );
            return;
          }
          await applyClassified(tx, batch.type as ImportType, batch.source as AcademicSourceValue, row.values, classified);
          await recordOutcome(tx, batchId, row, "UPDATED", null);
          return;
        }

        await recordOutcome(
          tx,
          batchId,
          row,
          "FAILED",
          "Status baris tidak dikenal."
        );
      });
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
    });
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
  return batch;
}

export async function failedRowsCsv(batchId: string) {
  const batch = await getBatch(batchId);
  const rows = batch.rows as unknown as PreviewRow[];
  const byRow = new Map(rows.map((row) => [row.rowNumber, row]));
  const headers = TEMPLATE_HEADERS[batch.type as ImportType];
  const failed = batch.outcomes.filter(
    (outcome) => outcome.action === "FAILED" || outcome.action === "CONFLICT"
  );

  const reportRows = failed.map((outcome) => {
    const row = byRow.get(outcome.rowNumber);
    const values = headers.map((header) => {
      const key =
        batch.type === "STUDY_PROGRAMS"
          ? {
              faculty_code: "facultyCode",
              faculty_name: "facultyName",
              study_program_code: "studyProgramCode",
              study_program_name: "studyProgramName",
            }[header]
          : batch.type === "COURSES"
            ? {
                faculty_code: "facultyCode",
                study_program_code: "studyProgramCode",
                course_code: "courseCode",
                course_name: "courseName",
                is_active: "isActive",
              }[header]
            : {
                nip: "nip",
                nidn: "nidn",
                name: "name",
                email: "email",
                is_active: "isActive",
              }[header];
      return key ? (row?.values[key] ?? "") : "";
    });
    return [
      outcome.rowNumber,
      outcome.message ?? "",
      outcome.identity,
      ...values,
    ];
  });

  return buildCsv(
    ["row_number", "error", "identity", ...headers],
    reportRows
  );
}

export function isImportType(value: string): value is ImportType {
  return (IMPORT_TYPES as readonly string[]).includes(value);
}

export function isAcademicSource(value: string): value is AcademicSourceValue {
  return (ACADEMIC_SOURCES as readonly string[]).includes(value);
}
