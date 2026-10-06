import type { CellValue, Workbook } from 'exceljs';

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface SheetSpec {
  name: string;
  rows: Array<Array<string | number>>;
  /** Column widths in characters, in column order */
  columnWidths?: number[];
}

// Loaded on demand: the library is large and only needed for Excel import/export.
// The package is CommonJS, so its exports sit on `default` once bundled.
async function createWorkbook(): Promise<Workbook> {
  const mod = (await import('exceljs')) as unknown as {
    Workbook?: typeof Workbook;
    default?: { Workbook: typeof Workbook };
  };
  const WorkbookCtor = mod.default?.Workbook ?? mod.Workbook;
  if (!WorkbookCtor) throw new Error('Moteur Excel indisponible.');
  return new WorkbookCtor();
}

export async function buildXlsxFile(sheets: SheetSpec[]): Promise<ArrayBuffer> {
  const workbook = await createWorkbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRows(sheet.rows);
    sheet.columnWidths?.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function cellToText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Excel dates carry no time zone and are read as UTC midnight
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return cellToText(value.result as CellValue);
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value);
}

function toCsvField(text: string): string {
  // The import parser reads one record per line
  const singleLine = text.replace(/\r?\n/g, ' ').trim();
  return /[;"]/.test(singleLine) ? `"${singleLine.replace(/"/g, '""')}"` : singleLine;
}

/**
 * Reads one sheet of an .xlsx file as semicolon-separated text, the format the
 * vehicle import parser expects. Picks the first sheet matching `preferSheet`, else the first sheet.
 */
export async function readXlsxSheetAsCsv(
  file: ArrayBuffer,
  preferSheet: (sheetName: string) => boolean
): Promise<{ sheetName: string; csv: string } | null> {
  const workbook = await createWorkbook();
  await workbook.xlsx.load(file as never);

  const worksheet = workbook.worksheets.find((ws) => preferSheet(ws.name)) ?? workbook.worksheets[0];
  if (!worksheet) return null;

  const lines: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const fields: string[] = [];
    for (let col = 1; col <= row.cellCount; col++) {
      fields.push(toCsvField(cellToText(row.getCell(col).value)));
    }
    if (fields.some((field) => field !== '')) lines.push(fields.join(';'));
  });

  return { sheetName: worksheet.name, csv: lines.join('\n') };
}
