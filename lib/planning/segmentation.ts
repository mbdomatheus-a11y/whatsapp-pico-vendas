import ExcelJS from "exceljs";

function text(value: ExcelJS.CellValue | undefined) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

export function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function parseSegmentationWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("A planilha de segmentacao nao possui abas");
  const codeHeaders = new Set(["COD", "COD_LOJA", "CODIGO_LOJA", "CODIGO_DA_LOJA"]);
  let headerRow = 0;
  let codeColumn = 0;
  for (let row = 1; row <= Math.min(sheet.rowCount, 50) && !codeColumn; row += 1) {
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      if (codeHeaders.has(normalizeHeader(text(sheet.getCell(row, column).value)))) {
        headerRow = row;
        codeColumn = column;
        break;
      }
    }
  }
  if (!codeColumn) throw new Error("Nao encontrei a coluna COD, COD_LOJA ou CODIGO_LOJA na planilha de segmentacao");
  const headers: string[] = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) headers[column] = normalizeHeader(text(sheet.getCell(headerRow, column).value));
  const byStore = new Map<string, Record<string, string>>();
  for (let row = headerRow + 1; row <= sheet.rowCount; row += 1) {
    const code = text(sheet.getCell(row, codeColumn).value).replace(/\.0$/, "").replace(/^0+/, "");
    if (!code) continue;
    const values: Record<string, string> = {};
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      if (column === codeColumn) continue;
      const key = headers[column];
      const value = text(sheet.getCell(row, column).value);
      if (key && value) values[key] = value;
    }
    byStore.set(code, values);
  }
  return byStore;
}
