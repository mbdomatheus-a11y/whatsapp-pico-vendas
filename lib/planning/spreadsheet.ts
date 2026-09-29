import ExcelJS from "exceljs";
import { WEEKDAYS, type PeakRow, type Weekday } from "./types";

function text(value: ExcelJS.CellValue | undefined) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

export async function parsePeakWorkbook(buffer: Buffer, day: Weekday): Promise<{ rows: PeakRow[]; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("A planilha nao possui abas");

  const fieldColumns = new Map<string, number>();
  const dayColumns = new Map<string, number>();
  const maxColumn = Math.max(sheet.columnCount, 12);
  for (let column = 1; column <= maxColumn; column += 1) {
    const field = normalize(text(sheet.getCell(2, column).value));
    const dayName = normalize(text(sheet.getCell(1, column).value));
    if (field) fieldColumns.set(field, column);
    if (dayName) dayColumns.set(dayName, column);
  }

  const required = ["GGL", "REGIONAL", "COD_LOJA", "NOME_LOJA", "TELEFONE"];
  for (const field of required) if (!fieldColumns.has(field)) throw new Error(`Coluna obrigatoria ausente: ${field}`);
  const dayColumn = dayColumns.get(normalize(day));
  if (!dayColumn) throw new Error(`Coluna do dia ${day} nao encontrada na linha 1`);

  const rows: PeakRow[] = [];
  const warnings: string[] = [];
  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const get = (field: string) => text(sheet.getCell(rowNumber, fieldColumns.get(field)!).value);
    const storeCode = get("COD_LOJA").replace(/\.0$/, "").trim();
    const storeName = get("NOME_LOJA");
    if (!storeCode && !storeName) continue;
    const phone = normalizePhone(get("TELEFONE"));
    const peakWindow = text(sheet.getCell(rowNumber, dayColumn).value).replace(/\s/g, "");
    if (!phone) warnings.push(`Linha ${rowNumber}: telefone invalido para a loja ${storeCode || storeName}`);
    if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(peakWindow)) warnings.push(`Linha ${rowNumber}: faixa de pico invalida para a loja ${storeCode || storeName}`);
    if (!phone || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(peakWindow)) continue;
    rows.push({ ggl: get("GGL"), regional: get("REGIONAL"), storeCode, storeName, phone, peakWindow });
  }
  if (!rows.length) throw new Error("Nenhuma linha valida foi encontrada para o dia selecionado");
  return { rows, warnings };
}
