import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse";
import {
  MAX_CELL_CHARS,
  MAX_COLUMNS,
  MAX_DATA_ROWS,
  MAX_FILE_BYTES,
  TEMPLATE_HEADERS,
  type ImportType,
} from "./constants";

export class ImportFileError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ImportFileError";
  }
}

export type RawCell = string | number | boolean | null;

export type RawImportRow = {
  rowNumber: number;
  cells: RawCell[];
};

export type ParsedImportFile = {
  digest: string;
  rows: RawImportRow[];
};

function fileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

const MAX_XLSX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

/** Reads the ZIP central directory without inflating; rejects ZIP64 and oversized workbooks. */
function assertZipBudget(buffer: Buffer): void {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buffer.length) {
    throw new ImportFileError("Isi berkas bukan XLSX yang valid.");
  }
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let total = 0;

  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ImportFileError("Isi berkas bukan XLSX yang valid.");
    }
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw new ImportFileError("Workbook XLSX terlalu besar.");
    }
    total += uncompressed;
    if (total > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new ImportFileError("Workbook XLSX terlalu besar setelah dekompresi.");
    }
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
}

function assertContentMatchesExtension(buffer: Buffer, fileName: string): "csv" | "xlsx" {
  const extension = fileExtension(fileName);
  if (extension === ".xls") {
    throw new ImportFileError("Format .xls lama tidak didukung. Gunakan CSV atau XLSX.");
  }
  if (extension !== ".csv" && extension !== ".xlsx") {
    throw new ImportFileError("Format berkas harus CSV atau XLSX.");
  }
  if (buffer.length === 0) {
    throw new ImportFileError("Berkas kosong.");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ImportFileError("Berkas melebihi batas 10 MB.");
  }

  const zip = isZip(buffer);
  if (extension === ".xlsx" && !zip) {
    throw new ImportFileError("Isi berkas bukan XLSX yang valid.");
  }
  if (extension === ".csv" && zip) {
    throw new ImportFileError("Isi berkas adalah arsip XLSX, bukan CSV.");
  }
  if (extension === ".csv" && buffer.includes(0)) {
    throw new ImportFileError("Berkas CSV bukan teks UTF-8 yang valid.");
  }
  if (extension === ".xlsx") assertZipBudget(buffer);
  return extension === ".xlsx" ? "xlsx" : "csv";
}

function normalizeHeader(values: RawCell[], headers: readonly string[]): void {
  const actual = values.map((value) =>
    value === null ? "" : String(value).replace(/^\uFEFF/, "").trim()
  );
  const expected = [...headers];
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new ImportFileError(
      `Header tidak sesuai template. Header yang diharapkan: ${expected.join(",")}.`
    );
  }
}

function parseCsv(text: string, headers: readonly string[]): Promise<RawImportRow[]> {
  return new Promise((resolve, reject) => {
    const records: RawImportRow[] = [];
    const parser = parse({
      bom: true,
      info: true,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 65536,
    });

    let headerSeen = false;
    parser.on("data", (chunk: unknown) => {
      const entry = chunk as { record: string[]; info: { lines: number } };
      if (!headerSeen) {
        headerSeen = true;
        normalizeHeader(entry.record, headers);
        return;
      }
      records.push({
        rowNumber: entry.info.lines,
        cells: entry.record.map((value) => String(value)),
      });
    });
    parser.on("error", (error: unknown) => {
      reject(
        error instanceof ImportFileError
          ? error
          : new ImportFileError("Isi CSV tidak valid.")
      );
    });
    parser.on("end", () => resolve(records));
    parser.write(text);
    parser.end();
  });
}

function formulaError(): never {
  throw new ImportFileError("Sel formula tidak diizinkan. Ganti dengan nilai biasa.");
}

function xlsxCellValue(cell: ExcelJS.Cell): RawCell {
  if (cell.formula || cell.type === ExcelJS.ValueType.Formula) {
    formulaError();
  }
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (value.length > MAX_CELL_CHARS) {
      throw new ImportFileError(`Isi sel melebihi ${MAX_CELL_CHARS} karakter.`);
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    if (value instanceof Date) {
      throw new ImportFileError("Sel tanggal tidak didukung.");
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      const text = value.richText.map((part) => part.text ?? "").join("");
      if (text.length > MAX_CELL_CHARS) {
        throw new ImportFileError(`Isi sel melebihi ${MAX_CELL_CHARS} karakter.`);
      }
      return text;
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("error" in value) {
      throw new ImportFileError("Sel berisi error Excel.");
    }
    if ("formula" in value) {
      formulaError();
    }
  }
  throw new ImportFileError("Tipe sel tidak didukung.");
}

async function parseXlsx(buffer: Buffer, headers: readonly string[]): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const nonEmpty = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (nonEmpty.length > 1) {
    throw new ImportFileError(
      "Workbook berisi lebih dari satu lembar data. Gunakan satu lembar data."
    );
  }
  const sheet = nonEmpty[0];
  if (!sheet) throw new ImportFileError("Workbook tidak memiliki lembar data.");

  const headerRow = sheet.getRow(1);
  const headerCells: RawCell[] = [];
  for (let column = 1; column <= Math.max(headerRow.cellCount, headers.length); column += 1) {
    headerCells.push(xlsxCellValue(headerRow.getCell(column)));
  }
  while (headerCells.length > 0 && headerCells[headerCells.length - 1] === null) {
    headerCells.pop();
  }
  normalizeHeader(headerCells, headers);

  if (sheet.actualRowCount - 1 > MAX_DATA_ROWS) {
    throw new ImportFileError(`Maksimal ${MAX_DATA_ROWS} baris data per impor.`);
  }

  const rows: RawImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = row.values as unknown[];
    const width = Math.min(Math.max(values.length - 1, 0), MAX_COLUMNS + 1);
    if (width > MAX_COLUMNS) {
      throw new ImportFileError(`Maksimal ${MAX_COLUMNS} kolom per impor.`);
    }
    const cells: RawCell[] = [];
    for (let column = 1; column <= width; column += 1) {
      cells.push(xlsxCellValue(row.getCell(column)));
    }
    if (cells.every((value) => value === null || value === "")) continue;
    rows.push({ rowNumber, cells });
  }
  return rows;
}

export async function parseImportFile(
  buffer: Buffer,
  fileName: string,
  type: ImportType
): Promise<ParsedImportFile> {
  const format = assertContentMatchesExtension(buffer, fileName);
  const headers = TEMPLATE_HEADERS[type];
  const rows =
    format === "xlsx"
      ? await parseXlsx(buffer, headers)
      : await parseCsv(buffer.toString("utf8"), headers);

  if (rows.length === 0) {
    throw new ImportFileError("Berkas tidak memiliki baris data.");
  }
  if (rows.length > MAX_DATA_ROWS) {
    throw new ImportFileError(`Maksimal ${MAX_DATA_ROWS} baris data per impor.`);
  }

  return {
    digest: crypto.createHash("sha256").update(buffer).digest("hex"),
    rows,
  };
}
