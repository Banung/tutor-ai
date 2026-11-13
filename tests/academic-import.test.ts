import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseImportFile, ImportFileError } from "../src/lib/academic-import/file-parser";
import {
  MAX_FILE_BYTES,
  TEMPLATE_HEADERS,
  normalizeIdentifier,
  toCsvValue,
} from "../src/lib/academic-import/constants";
import {
  AcademicImportError,
  failedRowsCsv,
  previewImport,
  type PreviewRow,
} from "../src/lib/academic-import/service";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/tutor_ai_test";

type AnyFn = (...args: unknown[]) => unknown;

function replaceMethod(target: object, name: string, impl: AnyFn) {
  const record = target as Record<string, unknown>;
  const original = record[name];
  record[name] = impl;
  return () => {
    record[name] = original;
  };
}

function csv(type: keyof typeof TEMPLATE_HEADERS, rows: (string | boolean)[][]): Buffer {
  return Buffer.from(
    [TEMPLATE_HEADERS[type].join(","), ...rows.map((row) => row.join(","))].join("\n"),
    "utf8"
  );
}

async function loadModule() {
  const [{ default: prisma }, service] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/academic-import/service"),
  ]);
  return { prisma, service };
}

type PreviewStubs = {
  facultyByCode?: unknown;
  facultyByName?: unknown[];
  programByCode?: unknown;
  programByName?: unknown[];
  courseByCode?: unknown;
  lecturers?: unknown[];
};

async function preview(
  stubs: PreviewStubs,
  type: keyof typeof TEMPLATE_HEADERS,
  rows: (string | boolean)[][],
  source: "SIAT" | "PIPP" = "SIAT"
) {
  const { prisma } = await loadModule();
  const created: { id: string; rows: PreviewRow[]; summary: Record<string, number> }[] = [];
  const restores = [
    replaceMethod(prisma.faculty, "findUnique", async () => stubs.facultyByCode ?? null),
    replaceMethod(prisma.faculty, "findMany", async () => stubs.facultyByName ?? []),
    replaceMethod(prisma.studyProgram, "findFirst", async () => stubs.programByCode ?? null),
    replaceMethod(prisma.studyProgram, "findMany", async () => stubs.programByName ?? []),
    replaceMethod(
      prisma.academicCourseReference,
      "findFirst",
      async () => stubs.courseByCode ?? null
    ),
    replaceMethod(prisma.lecturerReference, "findMany", async () => stubs.lecturers ?? []),
    replaceMethod(prisma.academicImportBatch, "create", async (args: unknown) => {
      const data = (args as { data: Record<string, unknown> }).data;
      const batch = {
        id: "batch-1",
        ...data,
        rows: data.rows,
      };
      created.push(batch as never);
      return batch;
    }),
  ];

  try {
    await previewImport({
      buffer: csv(type, rows),
      fileName: "data.csv",
      source,
      type,
      actorId: "admin-1",
    });
    assert.equal(created.length, 1);
    const batch = created[0];
    return {
      rows: batch.rows as unknown as PreviewRow[],
      summary: batch.summary as Record<string, number>,
    };
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
}

test("CSV and XLSX fixtures produce equivalent normalized preview rows", async () => {
  const studyRows = [
    ["FTIP", "Fakultas Teknologi Industri Pertanian", "TIP", "Teknologi Industri Pertanian"],
  ];
  const fromCsv = await preview({}, "STUDY_PROGRAMS", studyRows);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow([...TEMPLATE_HEADERS.STUDY_PROGRAMS]);
  sheet.addRow(studyRows[0]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const parsed = await parseImportFile(buffer, "data.xlsx", "STUDY_PROGRAMS");
  const parsedCsv = await parseImportFile(
    csv("STUDY_PROGRAMS", studyRows),
    "data.csv",
    "STUDY_PROGRAMS"
  );
  assert.deepEqual(
    parsed.rows.map((row) => row.cells),
    parsedCsv.rows.map((row) => row.cells)
  );
  assert.equal(fromCsv.rows[0].action, "CREATED");
});

test("CSV handles BOM and quoted commas/newlines", async () => {
  const text =
    "\uFEFFfaculty_code,faculty_name,study_program_code,study_program_name\nFTIP,\"Fakultas, Teknologi\",TIP,\"Program\nMultibaris\"\n";
  const parsed = await parseImportFile(Buffer.from(text), "data.csv", "STUDY_PROGRAMS");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].cells[1], "Fakultas, Teknologi");
  assert.equal(parsed.rows[0].cells[3], "Program\nMultibaris");
});

test("parser rejects wrong headers, misleading extensions, legacy XLS, and oversize files", async () => {
  await assert.rejects(
    () => parseImportFile(csv("STUDY_PROGRAMS", [["A", "B", "C", "D"]]), "x.csv", "COURSES"),
    ImportFileError
  );
  await assert.rejects(
    () => parseImportFile(csv("STUDY_PROGRAMS", []), "data.xlsx", "STUDY_PROGRAMS"),
    /bukan XLSX/
  );
  await assert.rejects(
    () => parseImportFile(csv("STUDY_PROGRAMS", []), "data.xls", "STUDY_PROGRAMS"),
    /\.xls/
  );
  await assert.rejects(
    () => parseImportFile(Buffer.alloc(MAX_FILE_BYTES + 1, 0x41), "big.csv", "STUDY_PROGRAMS"),
    /10 MB/
  );
  await assert.rejects(
    () => parseImportFile(Buffer.from("faculty_code\0"), "nul.csv", "STUDY_PROGRAMS"),
    /UTF-8/
  );
});

test("XLSX rejects formulas, extra data sheets, and numeric identifiers", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow([...TEMPLATE_HEADERS.STUDY_PROGRAMS]);
  sheet.addRow(["FTIP", "Fakultas", "TIP", "Program"]);
  sheet.getCell("B2").value = { formula: "1+1", result: 2 } as never;
  const formulaBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(
    () => parseImportFile(formulaBuffer, "data.xlsx", "STUDY_PROGRAMS"),
    /formula/i
  );

  const extra = new ExcelJS.Workbook();
  const first = extra.addWorksheet("Data");
  first.addRow([...TEMPLATE_HEADERS.STUDY_PROGRAMS]);
  first.addRow(["FTIP", "Fakultas", "TIP", "Program"]);
  const second = extra.addWorksheet("Lain");
  second.addRow(["x"]);
  const extraBuffer = Buffer.from(await extra.xlsx.writeBuffer());
  await assert.rejects(
    () => parseImportFile(extraBuffer, "data.xlsx", "STUDY_PROGRAMS"),
    /satu lembar/
  );

  const numeric = new ExcelJS.Workbook();
  const lecturerSheet = numeric.addWorksheet("Data");
  lecturerSheet.addRow([...TEMPLATE_HEADERS.LECTURERS]);
  lecturerSheet.addRow([1987654321, null, "Dosen", "dosen@example.ac.id", true]);
  const numericBuffer = Buffer.from(await numeric.xlsx.writeBuffer());
  const parsed = await parseImportFile(numericBuffer, "data.xlsx", "LECTURERS");
  assert.equal(parsed.rows[0].cells[0], 1987654321);
});

test("XLSX zip budget rejects ZIP64 and oversized decompressed workbooks", async () => {
  function fakeXlsx(uncompressed: number) {
    const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt32LE(1, 20);
    directory.writeUInt32LE(uncompressed, 24);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(header.length, 16);
    return Buffer.concat([header, directory, eocd]);
  }

  await assert.rejects(
    () => parseImportFile(fakeXlsx(65 * 1024 * 1024), "data.xlsx", "STUDY_PROGRAMS"),
    /terlalu besar setelah dekompresi/
  );
  await assert.rejects(
    () => parseImportFile(fakeXlsx(0xffffffff), "data.xlsx", "STUDY_PROGRAMS"),
    ImportFileError
  );
});

test("identifier boundaries, leading zeros, and strict booleans", () => {
  assert.equal(normalizeIdentifier("1234567").error !== null, true);
  assert.equal(normalizeIdentifier("12345678").value, "12345678");
  assert.equal(normalizeIdentifier("123456789012345678").value, "123456789012345678");
  assert.equal(normalizeIdentifier("1234567890123456789").error !== null, true);
  assert.equal(normalizeIdentifier("0012345678").value, "0012345678");
  assert.equal(normalizeIdentifier("1234abcd").error !== null, true);
  assert.equal(normalizeIdentifier("   ").value, null);
});

test("numeric identifier cells and non-boolean is_active fail their rows", async () => {
  const numericWorkbook = new ExcelJS.Workbook();
  const sheet = numericWorkbook.addWorksheet("Data");
  sheet.addRow([...TEMPLATE_HEADERS.LECTURERS]);
  sheet.addRow([1987654321, null, "Dosen", "dosen@example.ac.id", true]);
  const buffer = Buffer.from(await numericWorkbook.xlsx.writeBuffer());

  // Preview cannot be reached without a batch create stub; assert parser keeps number.
  const parsed = await parseImportFile(buffer, "data.xlsx", "LECTURERS");
  assert.equal(typeof parsed.rows[0].cells[0], "number");

  const result = await preview(
    {},
    "COURSES",
    [["FTIP", "TIP", "TIP101", "Mata Kuliah", "yes"]]
  );
  assert.equal(result.rows[0].action, "FAILED");
  assert.match(result.rows[0].errors.join(" "), /is_active harus true atau false/);
});

test("conflicting duplicate rows fail; identical duplicates are not re-applied", async () => {
  const conflicting = await preview(
    {},
    "STUDY_PROGRAMS",
    [
      ["FTIP", "Fakultas", "TIP", "Program A"],
      ["FTIP", "Fakultas", "TIP", "Program B"],
    ]
  );
  assert.equal(conflicting.rows.every((row) => row.action === "FAILED"), true);

  const identical = await preview(
    {},
    "STUDY_PROGRAMS",
    [
      ["FTIP", "Fakultas", "TIP", "Program A"],
      ["FTIP", "Fakultas", "TIP", "Program A"],
    ]
  );
  assert.equal(identical.rows[0].action, "CREATED");
  assert.equal(identical.rows[1].action, "UNCHANGED");
  assert.match(identical.rows[1].note ?? "", /duplikat identik/i);
});

test("lecturer split identity is rejected", async () => {
  const result = await preview(
    {
      lecturers: [
        { id: "l1", nip: "1987654321", nidn: null, name: "A", email: null, isActive: true, source: "SIAT", updatedAt: new Date() },
        { id: "l2", nip: null, nidn: "0012345678", name: "B", email: null, isActive: true, source: "SIAT", updatedAt: new Date() },
      ],
    },
    "LECTURERS",
    [["1987654321", "0012345678", "Dosen", "dosen@example.ac.id", "true"]]
  );
  assert.equal(result.rows[0].action, "FAILED");
  assert.match(result.rows[0].errors.join(" "), /dua dosen berbeda/);
});

test("SIAT precedence blocks PIPP overwrite but allows SIAT supersede", async () => {
  const existing = {
    id: "c1",
    name: "Lama",
    isActive: true,
    source: "SIAT" as const,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const row = ["FTIP", "TIP", "TIP101", "Baru", "true"];
  const pipp = await preview(
    {
      facultyByCode: { id: "f1" },
      programByCode: { id: "p1" },
      courseByCode: existing,
    },
    "COURSES",
    [row],
    "PIPP"
  );
  assert.equal(pipp.rows[0].action, "CONFLICT");

  const siat = await preview(
    {
      facultyByCode: { id: "f1" },
      programByCode: { id: "p1" },
      courseByCode: { ...existing, source: "PIPP" as const },
    },
    "COURSES",
    [row],
    "SIAT"
  );
  assert.equal(siat.rows[0].action, "UPDATED");

  const unchanged = await preview(
    {
      facultyByCode: { id: "f1" },
      programByCode: { id: "p1" },
      courseByCode: existing,
    },
    "COURSES",
    [["FTIP", "TIP", "TIP101", "Lama", "true"]],
    "PIPP"
  );
  assert.equal(unchanged.rows[0].action, "UNCHANGED");
});

test("unknown program fails course rows without inventing parents", async () => {
  const result = await preview(
    { facultyByCode: { id: "f1" }, programByCode: null },
    "COURSES",
    [["FTIP", "TIP", "TIP101", "Mata Kuliah", "true"]]
  );
  assert.equal(result.rows[0].action, "FAILED");
  assert.match(result.rows[0].errors.join(" "), /Impor program studi terlebih dahulu/);
});

test("failed-row CSV escapes values and neutralizes formulas", async () => {
  const batch = {
    id: "batch-1",
    type: "STUDY_PROGRAMS",
    rows: [
      {
        rowNumber: 2,
        identity: "FAC:FTIP|PROG:TIP",
        action: "FAILED",
        values: {
          facultyCode: "FTIP",
          facultyName: "=HYPERLINK(\"http://x\")",
          studyProgramCode: "TIP",
          studyProgramName: "Program, \"kutip\"",
        },
        errors: ["baris gagal, periksa"],
        targets: {},
      },
    ],
    outcomes: [
      {
        rowNumber: 2,
        identity: "FAC:FTIP|PROG:TIP",
        action: "FAILED",
        message: 'gagal, "kutip"',
      },
    ],
  };
  const { prisma } = await loadModule();
  const restore = replaceMethod(prisma.academicImportBatch, "findUnique", async () => batch);
  try {
    const output = await failedRowsCsv("batch-1");
    assert.match(output, /^row_number,error,identity,/);
    assert.match(output, /'=HYPERLINK/);
    assert.match(output, /"Program, ""kutip"""/);
    assert.doesNotMatch(output, /(^|\r\n)=HYPERLINK/);
    assert.equal(toCsvValue("@cmd"), "'@cmd");
  } finally {
    restore();
  }
});

type TxStubOptions = {
  actorRole?: string;
  batch: Record<string, unknown>;
  outcomes: Record<string, unknown>[];
  courseExisting?: unknown;
  onCreate?: () => void;
};

async function withConfirmStubs(
  options: TxStubOptions,
  run: (state: {
    batchUpdates: Record<string, unknown>[];
    createdCourses: Record<string, unknown>[];
  }) => Promise<void>
) {
  const { prisma } = await loadModule();
  const batchUpdates: Record<string, unknown>[] = [];
  const createdCourses: Record<string, unknown>[] = [];
  const outcomes = options.outcomes;
  let batch = { ...options.batch };

  const tx = {
    $queryRaw: async () => [{ id: batch.id }],
    $executeRaw: async () => 1,
    user: {
      findUnique: async () => ({
        id: "admin-1",
        role: options.actorRole ?? "admin",
      }),
    },
    academicImportBatch: {
      findUnique: async () => batch,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        batchUpdates.push(data);
        batch = { ...batch, ...data };
        return batch;
      },
    },
    faculty: {
      findUnique: async () => ({ id: "f1" }),
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "f1",
        ...data,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    studyProgram: {
      findFirst: async () => ({ id: "p1" }),
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "p1",
        ...data,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    academicCourseReference: {
      findFirst: async () => options.courseExisting ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        options.onCreate?.();
        createdCourses.push(data);
        return data;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    lecturerReference: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => data,
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    academicImportRowOutcome: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        outcomes.push(data);
        return data;
      },
    },
  };

  const restores = [
    replaceMethod(prisma, "$transaction", async (callback: unknown) =>
      (callback as (client: unknown) => Promise<unknown>)(tx)
    ),
    replaceMethod(prisma.user, "findUnique", async () => ({
      id: "admin-1",
      role: options.actorRole ?? "admin",
    })),
    replaceMethod(prisma.academicImportBatch, "findUnique", async () => ({
      ...batch,
      outcomes,
    })),
    replaceMethod(prisma.academicImportBatch, "update", async (args: unknown) => {
      const data = (args as { data: Record<string, unknown> }).data;
      batchUpdates.push(data);
      return { ...batch, ...data };
    }),
    replaceMethod(prisma.academicImportRowOutcome, "findMany", async () => outcomes),
  ];

  try {
    await run({ batchUpdates, createdCourses });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
}

const COURSE_VALUES = {
  facultyCode: "FTIP",
  studyProgramCode: "TIP",
  courseCode: "TIP101",
  courseName: "Mata Kuliah",
  isActive: true,
};

function courseBatch(rows: PreviewRow[], status = "PREVIEWED") {
  return {
    id: "batch-1",
    actorId: "admin-1",
    source: "SIAT",
    type: "COURSES",
    fileName: "data.csv",
    fileDigest: "digest",
    status,
    expiresAt: new Date(Date.now() + 60_000),
    summary: { total: rows.length, created: rows.length, updated: 0, unchanged: 0, failed: 0, conflict: 0, columns: [] },
    rows,
    createdCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
    conflictCount: 0,
    confirmedAt: null,
  };
}

test("confirm rejects non-admin actors before any claim", async () => {
  const { service } = await loadModule();
  await withConfirmStubs(
    {
      actorRole: "mahasiswa",
      batch: courseBatch([]),
      outcomes: [],
    },
    async () => {
      await assert.rejects(
        () => service.confirmImport("batch-1", "admin-1"),
        (error: unknown) =>
          error instanceof AcademicImportError && error.status === 403
      );
    }
  );
});

test("expired preview is marked expired and rejected", async () => {
  const { service } = await loadModule();
  await withConfirmStubs(
    {
      batch: {
        ...courseBatch([]),
        status: "PREVIEWED",
        expiresAt: new Date(Date.now() - 1000),
      },
      outcomes: [],
    },
    async ({ batchUpdates }) => {
      await assert.rejects(
        () => service.confirmImport("batch-1", "admin-1"),
        (error: unknown) =>
          error instanceof AcademicImportError && error.status === 409
      );
      assert.equal(batchUpdates.some((data) => data.status === "EXPIRED"), true);
    }
  );
});

test("stale preview target fails the row without applying it", async () => {
  const { service } = await loadModule();
  let updates = 0;
  const row: PreviewRow = {
    rowNumber: 2,
    identity: "x",
    action: "UPDATED",
    values: COURSE_VALUES,
    errors: [],
    targets: {
      courseReference: { id: "c1", updatedAt: "2026-01-01T00:00:00.000Z" },
    },
  };
  const outcomes: Record<string, unknown>[] = [];
  await withConfirmStubs(
    {
      batch: courseBatch([row]),
      outcomes,
      courseExisting: {
        id: "c1",
        name: "Lama",
        isActive: true,
        source: "SIAT",
        updatedAt: new Date("2026-02-01T00:00:00Z"),
      },
    },
    async ({ batchUpdates }) => {
      const txUpdate = updates;
      await service.confirmImport("batch-1", "admin-1");
      assert.equal(txUpdate, 0);
      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0].action, "FAILED");
      assert.match(String(outcomes[0].message), /berubah sejak pratinjau/);
      assert.equal(
        batchUpdates.some((data) => data.status === "PARTIAL"),
        true
      );
    }
  );
  updates = 0;
});

test("per-row transaction failure preserves earlier commits and reports partial", async () => {
  const { service } = await loadModule();
  const rows: PreviewRow[] = [
    {
      rowNumber: 2,
      identity: "a",
      action: "CREATED",
      values: { ...COURSE_VALUES, courseCode: "TIP101" },
      errors: [],
      targets: {},
    },
    {
      rowNumber: 3,
      identity: "b",
      action: "CREATED",
      values: { ...COURSE_VALUES, courseCode: "TIP102" },
      errors: [],
      targets: {},
    },
  ];
  const outcomes: Record<string, unknown>[] = [];
  let createCalls = 0;
  await withConfirmStubs(
    {
      batch: courseBatch(rows),
      outcomes,
      onCreate: () => {
        createCalls += 1;
        if (createCalls === 2) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
      },
    },
    async ({ batchUpdates, createdCourses }) => {
      await service.confirmImport("batch-1", "admin-1");
      assert.equal(createdCourses.length, 1);
      assert.deepEqual(
        outcomes.map((outcome) => outcome.action),
        ["CREATED", "FAILED"]
      );
      const finalUpdate = batchUpdates.findLast((data) => data.status);
      assert.equal(finalUpdate?.status, "PARTIAL");
      assert.equal(finalUpdate?.createdCount, 1);
      assert.equal(finalUpdate?.failedCount, 1);
    }
  );
});
