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
/** Absolute sheet row position cap: bounds sparse worksheets without losing blank-row gaps. */
const MAX_XLSX_ROW_INDEX = MAX_DATA_ROWS + 1000;

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

function countNewlines(values: string[]): number {
  return values.reduce((total, value) => total + (value.match(/\n/g)?.length ?? 0), 0);
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
      if (entry.record.length > MAX_COLUMNS) {
        reject(new ImportFileError(`Maksimal ${MAX_COLUMNS} kolom per impor.`));
        return;
      }
      for (const value of entry.record) {
        if (value.length > MAX_CELL_CHARS) {
          reject(new ImportFileError(`Isi sel melebihi ${MAX_CELL_CHARS} karakter.`));
          return;
        }
      }
      records.push({
        rowNumber: Math.max(1, entry.info.lines - countNewlines(entry.record)),
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

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ImportFileError("Berkas CSV bukan teks UTF-8 yang valid.");
  }
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
  if (sheet.rowCount > MAX_XLSX_ROW_INDEX) {
    throw new ImportFileError(
      `Posisi baris XLSX terlalu jauh (maksimal ${MAX_XLSX_ROW_INDEX}).`
    );
  }

  const headerRow = sheet.getRow(1);
  const headerCells: RawCell[] = [];
  for (let column = 1; column <= Math.max(headerRow.cellCount, headers.length); column += 1) {
    headerCells.push(xlsxCellValue(headerRow.getCell(column)));
  }
  while (headerCells.length > 0 && headerCells[headerCells.length - 1] === null) {
    headerCells.pop();
  }
  normalizeHeader(headerCells, headers);

  const rows: RawImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_XLSX_ROW_INDEX) {
      throw new ImportFileError(
        `Posisi baris XLSX terlalu jauh (maksimal ${MAX_XLSX_ROW_INDEX}).`
      );
    }
    const width = row.cellCount;
    if (width > MAX_COLUMNS) {
      throw new ImportFileError(`Maksimal ${MAX_COLUMNS} kolom per impor.`);
    }
    const cells: RawCell[] = [];
    for (let column = 1; column <= width; column += 1) {
      cells.push(xlsxCellValue(row.getCell(column)));
    }
    if (cells.every((value) => value === null || value === "")) return;
    rows.push({ rowNumber, cells });
    if (rows.length > MAX_DATA_ROWS) {
      throw new ImportFileError(`Maksimal ${MAX_DATA_ROWS} baris data per impor.`);
    }
  });
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
      : await parseCsv(decodeCsv(buffer), headers);

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
