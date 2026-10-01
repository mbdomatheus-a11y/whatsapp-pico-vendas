import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { parsePeakWorkbook } from "@/lib/planning/spreadsheet";
import { ScheduleDirectory } from "@/lib/planning/schedule-api";
import { WEEKDAYS, type Weekday, type PlannedMessage } from "@/lib/planning/types";
import { parseSegmentationWorkbook } from "@/lib/planning/segmentation";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { NO_SCHEDULE_MESSAGE_TEMPLATE, SCHEDULE_MESSAGE_TEMPLATE } from "@/lib/planning/templates";

export const runtime = "nodejs";

function render(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin","operador"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Seu perfil e somente consulta" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const segmentationFile = form.get("segmentationFile");
    const day = String(form.get("day") ?? "") as Weekday;
    const template = String(form.get("template") ?? SCHEDULE_MESSAGE_TEMPLATE).trim();
    const useSchedule = String(form.get("useSchedule") ?? "true") === "true";
    const accountId = String(form.get("accountId") ?? "");
    const accountMode = form.get("accountMode") === "round_robin" ? "round_robin" : "single";
    const accountIds = [...new Set(form.getAll("accountIds").map(String).filter(Boolean))];
    const accountRotationBatchSize = Number(form.get("accountRotationBatchSize"));
    const groupId = String(form.get("groupId") ?? "");
    const name = String(form.get("name") ?? "").trim();
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Envie uma planilha no formato .xlsx");
    if (file.size > 8 * 1024 * 1024) throw new Error("A planilha deve ter no maximo 8 MB");
    if (!WEEKDAYS.includes(day)) throw new Error("Dia da semana invalido");
    if (!template || template.length > 3000) throw new Error("Modelo de mensagem invalido");
    if (!name || name.length > 120) throw new Error("Nome da preparacao invalido");
    if (!auth.access.groups.some((group) => group.group_id === groupId)) throw new Error("Grupo invalido");
    if (accountMode === "single" && accountIds.length !== 1) throw new Error("Escolha uma conta para o envio");
    if (accountMode === "round_robin" && accountIds.length < 2) throw new Error("Selecione pelo menos duas contas para alternar");
    if (accountIds.length > 10) throw new Error("Selecione no maximo 10 contas");
    if (!Number.isInteger(accountRotationBatchSize) || accountRotationBatchSize < 1 || accountRotationBatchSize > 500) throw new Error("Informe entre 1 e 500 mensagens por conta antes de alternar");
    const { data: availableAccounts } = await auth.supabase.from("whatsapp_accounts").select("id").in("id", accountIds).eq("enabled", true);
    if ((availableAccounts ?? []).length !== accountIds.length) throw new Error("Uma ou mais contas de envio sao invalidas");

    const parsed = await parsePeakWorkbook(Buffer.from(await file.arrayBuffer()), day);
    const segmentation = segmentationFile instanceof File && segmentationFile.size > 0
      ? await parseSegmentationWorkbook(Buffer.from(await segmentationFile.arrayBuffer())) : new Map<string, Record<string, string>>();
    const directory = useSchedule ? await ScheduleDirectory.load() : null;
    const warnings = [...parsed.warnings];
    if (directory?.limited) warnings.push("A API retornou o limite de 1000 historicos. Algumas lojas podem aparecer sem escala recente.");
    const messages: PlannedMessage[] = [];
    const usedPhones = new Set<string>();
    let matchedStores = 0;
    const regionalRows = new Map<string, { phone: string; lines: string[] }>();
    for (const row of parsed.rows) {
      const segments = segmentation.get(row.storeCode.replace(/^0+/, "")) ?? {};
      const metrics = useSchedule ? directory?.metrics(row.storeCode, day, row.peakWindow) : null;
      const planned = metrics?.peakCount ?? null;
      if (useSchedule && planned == null) warnings.push(`Loja ${row.storeCode}: escala nao encontrada; a mensagem informara a ausencia da escala`);
      if (usedPhones.has(row.phone)) {
        warnings.push(`Loja ${row.storeCode}: telefone duplicado; mensagem excluida`);
        continue;
      }
      usedPhones.add(row.phone);
      if (planned != null) matchedStores += 1;
      const values = {
        ggl: row.ggl, regional: row.regional, cod_loja: row.storeCode, nome_loja: row.storeName,
        dia: day, faixa_pico: row.peakWindow, colaboradores_pico: useSchedule ? (planned ?? "SEM ESCALA") : "NAO UTILIZADO",
      };
      const messageTemplate = useSchedule && planned == null && template === SCHEDULE_MESSAGE_TEMPLATE ? NO_SCHEDULE_MESSAGE_TEMPLATE : template;
      messages.push({
        gerente_id: `LOJA-${row.storeCode}`, telefone: row.phone, mensagem: render(messageTemplate, values), loja: row.storeName,
        faixa_pico: row.peakWindow, colaboradores_no_pico: planned, media_colaboradores_dia: metrics?.averageDay ?? null,
        segmentos: { TIPO: "GERENTE", REGIONAL: segments.REGIONAL ?? row.regional, GGL: segments.GGL ?? row.ggl, ...segments },
      });
      let directorPhone = String(segments.TELEFONE_DIRETOR ?? segments.DIRETOR_TELEFONE ?? "").replace(/\D/g, "");
      if (directorPhone.length === 10 || directorPhone.length === 11) directorPhone = `55${directorPhone}`;
      const regional = segments.REGIONAL ?? row.regional;
      if (useSchedule && regional && /^55\d{10,11}$/.test(directorPhone)) {
        const group = regionalRows.get(regional) ?? { phone: directorPhone, lines: [] };
        group.lines.push(`${row.storeCode} ${row.storeName} | ${row.peakWindow} | ${planned ?? "SEM ESCALA"} | media dia ${metrics?.averageDay ?? "N/D"}`);
        regionalRows.set(regional, group);
      }
    }
    if (!messages.length) throw new Error("Nenhum destinatario valido foi encontrado na planilha");
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
    const preview = { messages, warnings, totalRows: parsed.rows.length, matchedStores, facets, useSchedule };
    const admin = createAdminClient();
    const { data: settings } = await admin.from("system_settings").select("retention_days").eq("organization_id", auth.access.profile.organization_id).single();
    const retentionDays = settings?.retention_days ?? 30;
    const expiresAt = retentionDays === 0 ? null : new Date(Date.now() + retentionDays * 86400000).toISOString();
    const { data: session, error: saveError } = await admin.from("planning_sessions").insert({
      organization_id: auth.access.profile.organization_id,
      group_id: groupId,
      created_by: auth.userId,
      whatsapp_account_id: accountId,
      whatsapp_account_ids: accountIds,
      account_mode: accountMode,
      account_rotation_batch_size: accountMode === "round_robin" ? accountRotationBatchSize : 1,
      name,
      weekday: day,
      message_template: template,
      use_schedule: useSchedule,
      source_file_name: file.name.slice(0, 180),
      segmentation_file_name: segmentationFile instanceof File && segmentationFile.size > 0 ? segmentationFile.name.slice(0, 180) : null,
      preview_payload: preview,
      expires_at: expiresAt,
    }).select("id").single();
    if (saveError || !session) throw new Error(saveError?.message ?? "Nao foi possivel salvar a preparacao");
    await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "planning_session_created", entityType: "planning_session", entityId: session.id, metadata: { name, day, totalRows: parsed.rows.length, messages: messages.length, useSchedule, hasSegmentation: !!(segmentationFile instanceof File && segmentationFile.size > 0), accountMode, accountCount: accountIds.length, accountRotationBatchSize } });
    return NextResponse.json({ sessionId: session.id, saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao preparar campanha" }, { status: 400 });
  }
}
