import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

type InputMessage = { gerente_id: string; telefone: string; mensagem: string };
const phonePattern = /^\d{10,15}$/;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!['master','admin','operador'].includes(auth.access.profile.role)) return NextResponse.json({ error: "Seu perfil e somente consulta" }, { status: 403 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const accountId = String(form.get("accountId") ?? "").trim();
  const preferredGroup = auth.access.preference?.selected_group_id ?? auth.access.groups[0]?.group_id;
  const groupId = String(form.get("groupId") ?? preferredGroup ?? "");
  const confirmationEnabled = form.get("confirmationEnabled") === "on";
  const planningSessionId = String(form.get("planningSessionId") ?? "").trim();
  const scheduleMode = String(form.get("scheduleMode") ?? "").trim();
  const scheduledLocal = String(form.get("scheduledAt") ?? "").trim();
  const scheduleRequested = scheduleMode === "scheduled" || (!scheduleMode && !!scheduledLocal);
  const normalizedSchedule = scheduledLocal && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(scheduledLocal)
    ? `${scheduledLocal}${scheduledLocal.length === 16 ? ":00" : ""}-03:00` : "";
  const scheduledAt = scheduleRequested && normalizedSchedule ? new Date(normalizedSchedule) : null;
  let messages: InputMessage[];
  try { messages = JSON.parse(String(form.get("messages") ?? "[]")); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }
  if (!name || !accountId || !Array.isArray(messages) || !messages.length || messages.length > 500) return NextResponse.json({ error: "Campanha invalida" }, { status: 400 });
  if (!auth.access.groups.some((group) => group.group_id === groupId)) return NextResponse.json({ error: "Grupo invalido" }, { status: 400 });
  if (scheduleRequested && !scheduledAt) return NextResponse.json({ error: "Informe uma data e um horario validos para o agendamento" }, { status: 400 });
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 5 * 60_000)) return NextResponse.json({ error: "Escolha um horario de Brasilia com pelo menos 5 minutos de antecedencia" }, { status: 400 });
  if (messages.length > 250 && form.get("riskAccepted") !== "on") return NextResponse.json({ error: "Confirme o fracionamento e o risco de bloqueio para campanhas acima de 250 mensagens" }, { status: 400 });
  if (messages.some((m) => !m.gerente_id || !phonePattern.test(m.telefone) || !m.mensagem?.trim())) return NextResponse.json({ error: "Mensagem invalida" }, { status: 400 });
  const files = form.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
  const pdfs = files.filter((file) => file.type === "application/pdf"); const images = files.filter((file) => ["image/jpeg","image/png","image/webp"].includes(file.type));
  if (files.length !== pdfs.length + images.length || pdfs.length > 1 || images.length > 3 || files.some((file) => file.size > 10 * 1024 * 1024)) return NextResponse.json({ error: "Anexos invalidos: ate um PDF e tres imagens, com 10 MB cada" }, { status: 400 });

  const { data: account } = await auth.supabase.from("whatsapp_accounts").select("id").eq("id", accountId).eq("enabled", true).single();
  if (!account) return NextResponse.json({ error: "Conta de envio invalida" }, { status: 400 });
  const admin = createAdminClient();
  if (planningSessionId) {
    const { data: planning } = await admin.from("planning_sessions").select("id,group_id,status").eq("id", planningSessionId).maybeSingle();
    if (!planning || planning.group_id !== groupId || planning.status !== "preparada") return NextResponse.json({ error: "Preparacao salva invalida ou ja utilizada" }, { status: 409 });
  }
  const { data: settings } = await admin.from("system_settings").select("delay_min_seconds,delay_max_seconds,batch_size,batch_pause_minutes").eq("organization_id", auth.access.profile.organization_id).single();
  const { data: campaign, error } = await admin.from("campaigns").insert({ name, created_by: auth.userId, total_messages: messages.length, whatsapp_account_id: accountId, group_id: groupId, scheduled_at: scheduledAt?.toISOString() ?? null, confirmation_enabled: confirmationEnabled, delay_min_seconds: settings?.delay_min_seconds ?? 1, delay_max_seconds: settings?.delay_max_seconds ?? 30, batch_size: messages.length > 250 ? Math.min(settings?.batch_size ?? 100, 100) : settings?.batch_size ?? 100, batch_pause_minutes: settings?.batch_pause_minutes ?? 10 }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = messages.map((m, index) => ({
    campaign_id: campaign.id, gerente_id: m.gerente_id, telefone: m.telefone,
    mensagem: m.mensagem.trim(), sequence_number: index + 1,
    idempotency_key: `${campaign.id}:${m.gerente_id}:${m.telefone}`,
  }));
  const { error: queueError } = await admin.from("message_queue").insert(rows);
  if (queueError) return NextResponse.json({ error: queueError.message }, { status: 400 });
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${auth.access.profile.organization_id}/${campaign.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await admin.storage.from("campaign-attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: `Falha no anexo ${file.name}: ${uploadError.message}` }, { status: 400 });
    await admin.from("campaign_attachments").insert({ campaign_id: campaign.id, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
  }
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: scheduledAt ? "campaign_scheduled" : "campaign_created", entityType: "campaign", entityId: campaign.id, metadata: { total: messages.length, confirmationEnabled, attachments: files.map((file) => file.name) } });
  if (planningSessionId) await admin.from("planning_sessions").update({ status: "convertida", campaign_id: campaign.id, updated_at: new Date().toISOString() }).eq("id", planningSessionId);
  if (request.headers.get("accept")?.includes("application/json")) return NextResponse.json({ ok: true, campaignId: campaign.id, redirectTo: "/campanhas" });
  return NextResponse.redirect(new URL("/campanhas", request.url), 303);
}
