import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { parsePeakWorkbook } from "@/lib/planning/spreadsheet";
import { ScheduleDirectory } from "@/lib/planning/schedule-api";
import { WEEKDAYS, type Weekday, type PlannedMessage } from "@/lib/planning/types";
import { parseSegmentationWorkbook } from "@/lib/planning/segmentation";

export const runtime = "nodejs";

const DEFAULT_TEMPLATE = "Ola! O pico de vendas da loja {cod_loja} - {nome_loja} nesta {dia} sera das {faixa_pico}. A escala planejada possui {colaboradores_pico} colaboradores com cobertura nesse periodo. Por favor, organize a equipe para maxima cobertura no pico e confirme o recebimento com OK.";
const NO_SCHEDULE_TEMPLATE = "Ola! O pico de vendas da loja {cod_loja} - {nome_loja} nesta {dia} sera das {faixa_pico}. Nao foi localizada escala planejada para este dia. Por favor, organize a equipe para maxima cobertura no pico e confirme o recebimento com OK.";

function render(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const segmentationFile = form.get("segmentationFile");
    const day = String(form.get("day") ?? "") as Weekday;
    const template = String(form.get("template") ?? DEFAULT_TEMPLATE).trim();
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Envie uma planilha no formato .xlsx");
    if (file.size > 8 * 1024 * 1024) throw new Error("A planilha deve ter no maximo 8 MB");
    if (!WEEKDAYS.includes(day)) throw new Error("Dia da semana invalido");
    if (!template || template.length > 3000) throw new Error("Modelo de mensagem invalido");

    const parsed = await parsePeakWorkbook(Buffer.from(await file.arrayBuffer()), day);
    const segmentation = segmentationFile instanceof File && segmentationFile.size > 0
      ? await parseSegmentationWorkbook(Buffer.from(await segmentationFile.arrayBuffer())) : new Map<string, Record<string, string>>();
    const directory = await ScheduleDirectory.load();
    const warnings = [...parsed.warnings];
    if (directory.limited) warnings.push("A API retornou o limite de 1000 historicos. Lojas sem escala recente foram excluidas do rascunho para evitar mensagens incorretas.");
    const messages: PlannedMessage[] = [];
    const usedPhones = new Set<string>();
    let matchedStores = 0;
    const regionalRows = new Map<string, { phone: string; lines: string[] }>();
    for (const row of parsed.rows) {
      const segments = segmentation.get(row.storeCode.replace(/^0+/, "")) ?? {};
      const metrics = directory.metrics(row.storeCode, day, row.peakWindow);
      const planned = metrics?.peakCount ?? null;
      if (planned == null) warnings.push(`Loja ${row.storeCode}: escala nao encontrada; a mensagem informara a ausencia da escala`);
      if (usedPhones.has(row.phone)) {
        warnings.push(`Loja ${row.storeCode}: telefone duplicado; mensagem excluida`);
        continue;
      }
      usedPhones.add(row.phone);
      if (planned != null) matchedStores += 1;
      const values = {
        ggl: row.ggl, regional: row.regional, cod_loja: row.storeCode, nome_loja: row.storeName,
        dia: day, faixa_pico: row.peakWindow, colaboradores_pico: planned ?? "SEM ESCALA",
      };
      messages.push({
        gerente_id: `LOJA-${row.storeCode}`, telefone: row.phone, mensagem: render(planned == null ? NO_SCHEDULE_TEMPLATE : template, values), loja: row.storeName,
        faixa_pico: row.peakWindow, colaboradores_no_pico: planned, media_colaboradores_dia: metrics?.averageDay ?? null,
        segmentos: { TIPO: "GERENTE", REGIONAL: segments.REGIONAL ?? row.regional, GGL: segments.GGL ?? row.ggl, ...segments },
      });
      let directorPhone = String(segments.TELEFONE_DIRETOR ?? segments.DIRETOR_TELEFONE ?? "").replace(/\D/g, "");
      if (directorPhone.length === 10 || directorPhone.length === 11) directorPhone = `55${directorPhone}`;
      const regional = segments.REGIONAL ?? row.regional;
      if (regional && /^55\d{10,11}$/.test(directorPhone)) {
        const group = regionalRows.get(regional) ?? { phone: directorPhone, lines: [] };
        group.lines.push(`${row.storeCode} ${row.storeName} | ${row.peakWindow} | ${planned ?? "SEM ESCALA"} | media dia ${metrics?.averageDay ?? "N/D"}`);
        regionalRows.set(regional, group);
      }
    }
    if (!messages.length) throw new Error("Nenhuma loja da planilha possui escala correspondente na resposta atual da API");
    for (const [regional, group] of regionalRows) {
      const header = `Resumo regional ${regional} - ${day}\nLoja | Pico | Colaboradores no pico | Media do dia`;
      let part = header; let partNumber = 1;
      for (const line of group.lines) {
        if (`${part}\n${line}`.length > 3800) {
          messages.push({ gerente_id: `DIRETOR-${regional}-${partNumber}`, telefone: group.phone, mensagem: `${part}\n\nParte ${partNumber}`, loja: `Regional ${regional}`, faixa_pico: "RESUMO", colaboradores_no_pico: null, segmentos: { TIPO: "DIRETOR", REGIONAL: regional } });
          part = header; partNumber += 1;
        }
        part += `\n${line}`;
      }
      messages.push({ gerente_id: `DIRETOR-${regional}-${partNumber}`, telefone: group.phone, mensagem: partNumber > 1 ? `${part}\n\nParte ${partNumber}` : part, loja: `Regional ${regional}`, faixa_pico: "RESUMO", colaboradores_no_pico: null, segmentos: { TIPO: "DIRETOR", REGIONAL: regional } });
    }
    const facets: Record<string, string[]> = {};
    for (const message of messages) for (const [key, value] of Object.entries(message.segmentos ?? {})) if (value) facets[key] = [...new Set([...(facets[key] ?? []), value])].sort();
    return NextResponse.json({ messages, warnings, totalRows: parsed.rows.length, matchedStores, facets, defaultTemplate: DEFAULT_TEMPLATE });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao preparar campanha" }, { status: 400 });
  }
}
