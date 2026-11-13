import ExcelJS from "exceljs";
import {
  TEMPLATE_EXAMPLES,
  TEMPLATE_HEADERS,
  buildCsv,
  type ImportType,
} from "./constants";

export function templateCsv(type: ImportType): string {
  return buildCsv([...TEMPLATE_HEADERS[type]], TEMPLATE_EXAMPLES[type].map((row) => [...row]));
}

export async function templateXlsx(type: ImportType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow([...TEMPLATE_HEADERS[type]]);
  for (const example of TEMPLATE_EXAMPLES[type]) {
    sheet.addRow([...example]);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns = TEMPLATE_HEADERS[type].map((header) => ({
    header,
    width: Math.max(18, header.length + 4),
  }));
  // No formulas, external links, or macros: a plain single-sheet template.
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
