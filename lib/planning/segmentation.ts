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
  const headers: string[] = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) headers[column] = normalizeHeader(text(sheet.getCell(1, column).value));
  if (!["COD", "COD_LOJA", "CODIGO_LOJA"].includes(headers[1])) throw new Error("A primeira coluna da segmentacao deve ser COD ou COD_LOJA");
  const byStore = new Map<string, Record<string, string>>();
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const code = text(sheet.getCell(row, 1).value).replace(/\.0$/, "").replace(/^0+/, "");
    if (!code) continue;
    const values: Record<string, string> = {};
    for (let column = 2; column <= headers.length; column += 1) {
      const key = headers[column];
      const value = text(sheet.getCell(row, column).value);
      if (key && value) values[key] = value;
    }
    byStore.set(code, values);
  }
  return byStore;
}
