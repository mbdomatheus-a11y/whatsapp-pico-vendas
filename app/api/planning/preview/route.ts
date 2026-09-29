import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { parsePeakWorkbook } from "@/lib/planning/spreadsheet";
import { ScheduleDirectory } from "@/lib/planning/schedule-api";
import { WEEKDAYS, type Weekday, type PlannedMessage } from "@/lib/planning/types";

export const runtime = "nodejs";

const DEFAULT_TEMPLATE = "Ola! O pico de vendas da loja {cod_loja} - {nome_loja} nesta {dia} sera das {faixa_pico}. A escala planejada possui {colaboradores_pico} colaboradores com cobertura nesse periodo. Por favor, organize a equipe para maxima cobertura no pico e confirme o recebimento com OK.";

function render(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const day = String(form.get("day") ?? "") as Weekday;
    const template = String(form.get("template") ?? DEFAULT_TEMPLATE).trim();
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Envie uma planilha no formato .xlsx");
    if (file.size > 8 * 1024 * 1024) throw new Error("A planilha deve ter no maximo 8 MB");
    if (!WEEKDAYS.includes(day)) throw new Error("Dia da semana invalido");
    if (!template || template.length > 3000) throw new Error("Modelo de mensagem invalido");

    const parsed = await parsePeakWorkbook(Buffer.from(await file.arrayBuffer()), day);
    const directory = await ScheduleDirectory.load();
    const warnings = [...parsed.warnings];
    if (directory.limited) warnings.push("A API retornou o limite de 1000 historicos. Lojas sem escala recente foram excluidas do rascunho para evitar mensagens incorretas.");
    const messages: PlannedMessage[] = [];
    const usedPhones = new Set<string>();
    let matchedStores = 0;
    for (const row of parsed.rows) {
      const planned = directory.countDuringPeak(row.storeCode, day, row.peakWindow);
      if (planned == null) {
        warnings.push(`Loja ${row.storeCode}: escala nao encontrada na API; mensagem excluida`);
        continue;
      }
      if (usedPhones.has(row.phone)) {
        warnings.push(`Loja ${row.storeCode}: telefone duplicado; mensagem excluida`);
        continue;
      }
      usedPhones.add(row.phone);
      matchedStores += 1;
      const values = {
        ggl: row.ggl, regional: row.regional, cod_loja: row.storeCode, nome_loja: row.storeName,
        dia: day, faixa_pico: row.peakWindow, colaboradores_pico: planned ?? 0,
      };
      messages.push({
        gerente_id: `LOJA-${row.storeCode}`, telefone: row.phone, mensagem: render(template, values), loja: row.storeName,
        faixa_pico: row.peakWindow, colaboradores_no_pico: planned,
      });
    }
    if (!messages.length) throw new Error("Nenhuma loja da planilha possui escala correspondente na resposta atual da API");
    return NextResponse.json({ messages, warnings, totalRows: parsed.rows.length, matchedStores, defaultTemplate: DEFAULT_TEMPLATE });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao preparar campanha" }, { status: 400 });
  }
}
