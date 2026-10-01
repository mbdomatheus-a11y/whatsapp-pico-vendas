import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const REPORT_TYPES = ["campaigns", "queue", "communications", "confirmations", "inbound", "audit", "accounts"] as const;
type ReportType = typeof REPORT_TYPES[number];

function dateBoundary(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T${end ? "23:59:59.999" : "00:00:00.000"}-03:00`;
}

function relatedName(value: unknown) {
  if (Array.isArray(value)) return String(value[0]?.name ?? "-");
  return String((value as { name?: string } | null)?.name ?? "-");
}

function applyDates(query: any, column: string, from: string | null, to: string | null) {
  let next = query;
  if (from) next = next.gte(column, from);
  if (to) next = next.lte(column, to);
  return next;
}

async function paged(build: () => any) {
  const result: any[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const allowedGroupIds = auth.access.groups.map((item) => item.group_id);
  const groupId = url.searchParams.get("groupId") ?? "";
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const actorId = url.searchParams.get("actorId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const from = dateBoundary(url.searchParams.get("dateFrom"));
  const to = dateBoundary(url.searchParams.get("dateTo"), true);
  const selectedGroups = groupId ? [groupId] : allowedGroupIds;
  if (!selectedGroups.length || selectedGroups.some((id) => !allowedGroupIds.includes(id))) return NextResponse.json({ error: "Projeto ou grupo invalido" }, { status: 400 });
  if (status && !["pendente","pronto_para_envio","processando","enviado","erro","cancelado"].includes(status)) return NextResponse.json({ error: "Status invalido" }, { status: 400 });
  const admin = createAdminClient();
  if (campaignId) {
    const { data } = await admin.from("campaigns").select("id").eq("id", campaignId).in("group_id", selectedGroups).maybeSingle();
    if (!data) return NextResponse.json({ error: "Campanha fora do escopo permitido" }, { status: 403 });
  }

  const campaignFilter = (query: any) => {
    let next = query.in("group_id", selectedGroups);
    if (campaignId) next = next.eq("id", campaignId);
    return applyDates(next, "created_at", from, to);
  };
  const queueFilter = (query: any) => {
    let next = query.in("campaigns.group_id", selectedGroups);
    if (campaignId) next = next.eq("campaign_id", campaignId);
    if (status) next = next.eq("status", status);
    return applyDates(next, "created_at", from, to);
  };
  const groupFilter = (query: any, dateColumn: string) => {
    let next = query.in("group_id", selectedGroups);
    if (campaignId) next = next.eq("campaign_id", campaignId);
    return applyDates(next, dateColumn, from, to);
  };
  const confirmationFilter = (query: any) => {
    let next = query.in("campaigns.group_id", selectedGroups);
    if (campaignId) next = next.eq("campaign_id", campaignId);
    return applyDates(next, "confirmed_at", from, to);
  };
  const auditFilter = (query: any) => {
    let next = query.eq("organization_id", auth.access.profile.organization_id);
    if (groupId) next = next.eq("group_id", groupId);
    if (actorId) next = next.eq("actor_id", actorId);
    return applyDates(next, "created_at", from, to);
  };

  if (url.searchParams.get("format") !== "xlsx") {
    const [campaigns, queue, communications, confirmations, inbound, audit] = await Promise.all([
      campaignFilter(admin.from("campaigns").select("id", { count: "exact", head: true })),
      queueFilter(admin.from("message_queue").select("id,status", { count: "exact" }).limit(5000)),
      groupFilter(admin.from("communication_logs").select("id", { count: "exact", head: true }), "sent_at"),
      confirmationFilter(admin.from("read_confirmations").select("id,campaigns!inner(group_id)", { count: "exact", head: true })),
      groupFilter(admin.from("inbound_events").select("id", { count: "exact", head: true }), "received_at"),
      auditFilter(admin.from("audit_logs").select("id", { count: "exact", head: true })),
    ]);
    const errors = [campaigns.error, queue.error, communications.error, confirmations.error, inbound.error, audit.error].filter(Boolean);
    if (errors.length) return NextResponse.json({ error: errors[0]?.message ?? "Falha ao consultar relatorios" }, { status: 400 });
    const statuses = (queue.data ?? []).reduce((totals: Record<string, number>, item: { status: string }) => { totals[item.status] = (totals[item.status] ?? 0) + 1; return totals; }, {});
    return NextResponse.json({ summary: { campaigns: campaigns.count ?? 0, queue: queue.count ?? 0, sent: statuses.enviado ?? 0, failures: statuses.erro ?? 0, canceled: statuses.cancelado ?? 0, communications: communications.count ?? 0, confirmations: confirmations.count ?? 0, inbound: inbound.count ?? 0, audit: audit.count ?? 0 } });
  }

  const requested = (url.searchParams.get("types") ?? REPORT_TYPES.join(",")).split(",").filter((item): item is ReportType => REPORT_TYPES.includes(item as ReportType));
  if (!requested.length) return NextResponse.json({ error: "Selecione ao menos um relatorio" }, { status: 400 });
  const [{ data: groups }, { data: profiles }] = await Promise.all([
    admin.from("user_groups").select("id,name").in("id", selectedGroups),
    admin.from("user_profiles").select("user_id,full_name").eq("organization_id", auth.access.profile.organization_id),
  ]);
  const groupNames = new Map((groups ?? []).map((item) => [item.id, item.name]));
  const profileNames = new Map((profiles ?? []).map((item) => [item.user_id, item.full_name]));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WhatsApp OK";
  workbook.created = new Date();
  const addSheet = (name: string, columns: Array<{ header: string; key: string; width?: number }>, rows: Record<string, unknown>[]) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns;
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFEFEFE" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A4E58" } };
    sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}1` };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  };

  if (requested.includes("campaigns")) {
    const rows = await paged(() => campaignFilter(admin.from("campaigns").select("id,group_id,name,status,total_messages,account_mode,account_rotation_batch_size,scheduled_at,created_at,created_by").order("created_at", { ascending: false })));
    addSheet("Campanhas", [{header:"Projeto",key:"group",width:24},{header:"Campanha",key:"name",width:35},{header:"Status",key:"status",width:20},{header:"Mensagens",key:"total",width:12},{header:"Modo de contas",key:"mode",width:18},{header:"Troca a cada",key:"rotation",width:12},{header:"Agendada para",key:"scheduled",width:22},{header:"Criada em",key:"created",width:22},{header:"Criada por",key:"actor",width:28}], rows.map((item) => ({ group: groupNames.get(item.group_id) ?? "-", name:item.name,status:item.status,total:item.total_messages,mode:item.account_mode,rotation:item.account_rotation_batch_size,scheduled:item.scheduled_at ? new Date(item.scheduled_at) : "",created:new Date(item.created_at),actor:profileNames.get(item.created_by) ?? "Sistema" })));
  }
  if (requested.includes("queue")) {
    const rows = await paged(() => queueFilter(admin.from("message_queue").select("id,campaign_id,gerente_id,status,tentativas,destination_masked,erro,enviado_em,created_at,sequence_number,campaigns!inner(name,group_id),whatsapp_accounts(label,phone_number)").order("created_at", { ascending: false })));
    addSheet("Envios", [{header:"Projeto",key:"group",width:24},{header:"Campanha",key:"campaign",width:35},{header:"Sequencia",key:"sequence",width:11},{header:"Destinatario",key:"recipient",width:22},{header:"Telefone protegido",key:"destination",width:18},{header:"Conta",key:"account",width:24},{header:"Status",key:"status",width:20},{header:"Tentativas",key:"attempts",width:11},{header:"Erro",key:"error",width:45},{header:"Criado em",key:"created",width:22},{header:"Enviado em",key:"sent",width:22}], rows.map((item) => ({ group:groupNames.get((Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns)?.group_id) ?? "-",campaign:relatedName(item.campaigns),sequence:item.sequence_number,recipient:item.gerente_id,destination:item.destination_masked ?? "Protegido",account:relatedName(item.whatsapp_accounts),status:item.status,attempts:item.tentativas,error:item.erro ?? "",created:new Date(item.created_at),sent:item.enviado_em ? new Date(item.enviado_em) : "" })));
  }
  if (requested.includes("communications")) {
    const rows = await paged(() => groupFilter(admin.from("communication_logs").select("id,group_id,campaign_id,actor_id,recipient_label,destination_masked,message_text,attachment_names,provider_id,sent_at,expires_at,campaigns(name)").order("sent_at", { ascending: false }), "sent_at"));
    addSheet("Comunicacoes", [{header:"Projeto",key:"group",width:24},{header:"Campanha",key:"campaign",width:35},{header:"Destinatario",key:"recipient",width:22},{header:"Telefone protegido",key:"destination",width:18},{header:"Mensagem",key:"message",width:60},{header:"Anexos",key:"attachments",width:35},{header:"Enviado por",key:"actor",width:28},{header:"Enviado em",key:"sent",width:22},{header:"Expira em",key:"expires",width:22}], rows.map((item) => ({ group:groupNames.get(item.group_id) ?? "-",campaign:relatedName(item.campaigns),recipient:item.recipient_label,destination:item.destination_masked,message:item.message_text,attachments:(item.attachment_names ?? []).join(", "),actor:profileNames.get(item.actor_id) ?? "Sistema",sent:new Date(item.sent_at),expires:item.expires_at ? new Date(item.expires_at) : "" })));
  }
  if (requested.includes("confirmations")) {
    const rows = await paged(() => confirmationFilter(admin.from("read_confirmations").select("id,campaign_id,message_id,confirmed_at,expires_at,campaigns!inner(name,group_id)").order("confirmed_at", { ascending: false })));
    addSheet("Confirmacoes", [{header:"Projeto",key:"group",width:24},{header:"Campanha",key:"campaign",width:35},{header:"Mensagem ID",key:"message",width:38},{header:"Confirmada em",key:"confirmed",width:22},{header:"Expira em",key:"expires",width:22}], rows.map((item) => ({ group:groupNames.get((Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns)?.group_id) ?? "-",campaign:relatedName(item.campaigns),message:item.message_id,confirmed:item.confirmed_at ? new Date(item.confirmed_at) : "",expires:new Date(item.expires_at) })));
  }
  if (requested.includes("inbound")) {
    const rows = await paged(() => groupFilter(admin.from("inbound_events").select("id,group_id,campaign_id,event_type,sender_masked,content,received_at,campaigns(name)").order("received_at", { ascending: false }), "received_at"));
    addSheet("Retornos", [{header:"Projeto",key:"group",width:24},{header:"Campanha",key:"campaign",width:35},{header:"Tipo",key:"type",width:14},{header:"Remetente protegido",key:"sender",width:20},{header:"Conteudo",key:"content",width:60},{header:"Recebido em",key:"received",width:22}], rows.map((item) => ({ group:groupNames.get(item.group_id) ?? "-",campaign:relatedName(item.campaigns),type:item.event_type,sender:item.sender_masked,content:item.content,received:new Date(item.received_at) })));
  }
  if (requested.includes("audit")) {
    const rows = await paged(() => auditFilter(admin.from("audit_logs").select("id,group_id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false })));
    addSheet("Auditoria", [{header:"Projeto",key:"group",width:24},{header:"Usuario",key:"actor",width:28},{header:"Atividade",key:"action",width:32},{header:"Tipo de objeto",key:"entityType",width:20},{header:"Objeto ID",key:"entityId",width:38},{header:"Detalhes",key:"metadata",width:60},{header:"Data",key:"created",width:22}], rows.map((item) => ({ group:item.group_id ? groupNames.get(item.group_id) ?? "-" : "Organizacao",actor:profileNames.get(item.actor_id) ?? "Sistema",action:item.action,entityType:item.entity_type,entityId:item.entity_id,metadata:JSON.stringify(item.metadata ?? {}),created:new Date(item.created_at) })));
  }
  if (requested.includes("accounts")) {
    const { data: rows, error } = await admin.from("whatsapp_accounts").select("label,phone_number,instance_name,enabled,created_at").eq("organization_id", auth.access.profile.organization_id).order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    addSheet("Contas WhatsApp", [{header:"Nome",key:"label",width:28},{header:"Numero",key:"phone",width:20},{header:"Identificador tecnico",key:"instance",width:30},{header:"Ativa",key:"enabled",width:10},{header:"Criada em",key:"created",width:22}], (rows ?? []).map((item) => ({ label:item.label,phone:item.phone_number ?? "Nao informado",instance:item.instance_name,enabled:item.enabled ? "Sim" : "Nao",created:new Date(item.created_at) })));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `whatsapp-ok-relatorios-${new Date().toISOString().slice(0,10)}.xlsx`;
  return new NextResponse(Buffer.from(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" } });
}
