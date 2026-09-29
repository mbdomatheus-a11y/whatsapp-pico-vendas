import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await params;
  const { data: campaign } = await auth.supabase.from("campaigns").select("id,status,created_by,scheduled_at,group_id,delay_min_seconds,delay_max_seconds,batch_size,batch_pause_minutes").eq("id", id).eq("created_by", auth.userId).single();
  if (!campaign || !["autorizada", "processando"].includes(campaign.status)) return NextResponse.json({ error: "A campanha precisa estar autorizada para iniciar os envios" }, { status: 409 });
  if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) return NextResponse.json({ error: "Campanha agendada para uma data futura", scheduledAt: campaign.scheduled_at }, { status: 409 });

  const admin = createAdminClient();
  if (campaign.status === "autorizada") await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "campaign_dispatch_started", entityType: "campaign", entityId: id });
  const { data, error } = await admin.rpc("claim_campaign_message", { target_campaign: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const claimed = Array.isArray(data) ? data[0] : data;
  if (!claimed) return NextResponse.json({ processed: 0, sent: 0, failed: 0, remaining: 0, complete: true });
  let text = claimed.mensagem as string;
  if (claimed.confirmation_enabled) {
    const token = randomBytes(32).toString("base64url"); const tokenHash = createHash("sha256").update(token).digest("hex");
    await admin.from("read_confirmations").delete().eq("message_id", claimed.id).is("confirmed_at", null);
    await admin.from("read_confirmations").insert({ campaign_id: id, message_id: claimed.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
    const appUrl = process.env.APP_URL ?? "https://whatsapp-pico-vendas.vercel.app";
    text += `\n\nConfirme o recebimento: ${appUrl}/c/${token}`;
  }
  const { data: attachments } = await admin.from("campaign_attachments").select("storage_path,file_name,mime_type").eq("campaign_id", id).order("created_at");
  const provider = new EvolutionProvider(claimed.instance_name);
  let result;
  if (attachments?.length) {
    result = { success: true } as { success: true; externalId?: string } | { success: false; error: string };
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index]; const { data: signed } = await admin.storage.from("campaign-attachments").createSignedUrl(attachment.storage_path, 300);
      if (!signed?.signedUrl) { result = { success: false, error: `Falha ao preparar ${attachment.file_name}` }; break; }
      result = await provider.sendMedia({ destination: claimed.telefone, text: index === 0 ? text : "", mediaUrl: signed.signedUrl, fileName: attachment.file_name, mimeType: attachment.mime_type, idempotencyKey: `${claimed.idempotency_key}:attachment:${index}` });
      if (!result.success) break;
    }
  } else result = await provider.sendText({ destination: claimed.telefone, text, idempotencyKey: claimed.idempotency_key });
  if (result.success) {
    const { data: group } = await admin.from("user_groups").select("organization_id").eq("id", claimed.group_id).single();
    const { data: settings } = await admin.from("system_settings").select("retention_days").eq("organization_id", group?.organization_id).single();
    const retention = settings?.retention_days ?? 30;
    await admin.from("communication_logs").insert({ organization_id: group?.organization_id, group_id: claimed.group_id, campaign_id: id, message_id: claimed.id, actor_id: auth.userId, recipient_label: claimed.gerente_id, destination_masked: `********${String(claimed.telefone).slice(-4)}`, message_text: claimed.mensagem, attachment_names: (attachments ?? []).map((item) => item.file_name), provider_id: result.externalId ?? null, expires_at: retention === 0 ? null : new Date(Date.now() + retention * 86400000).toISOString() });
  }
  await admin.rpc("finish_message", { target_id: claimed.id, was_success: result.success, provider_id: result.success ? result.externalId ?? null : null, error_text: result.success ? null : result.error });
  const { count: remaining } = await admin.from("message_queue").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pronto_para_envio");
  const min = campaign.delay_min_seconds ?? 1; const max = campaign.delay_max_seconds ?? 30;
  const randomDelayMs = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
  const { count: completed } = await admin.from("message_queue").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "enviado");
  const atBatchBoundary = (completed ?? 0) > 0 && (completed ?? 0) % (campaign.batch_size ?? 100) === 0;
  const nextDelayMs = atBatchBoundary ? (campaign.batch_pause_minutes ?? 10) * 60000 : randomDelayMs;
  return NextResponse.json({ processed: 1, sent: result.success ? 1 : 0, failed: result.success ? 0 : 1, remaining: remaining ?? 0, complete: (remaining ?? 0) === 0, nextDelayMs });
}
