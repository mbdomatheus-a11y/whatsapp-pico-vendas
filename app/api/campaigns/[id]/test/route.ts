import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { writeAudit } from "@/lib/audit";

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const { data: message, error } = await auth.supabase.from("message_queue").select("mensagem,campaigns(whatsapp_accounts(instance_name))").eq("campaign_id", id).order("sequence_number").limit(1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const admin = createAdminClient();
  const { data: savedRecipients, error: recipientsError } = await admin.from("test_recipients").select("id,phone").eq("organization_id", auth.access.profile.organization_id).eq("active", true).order("created_at");
  if (recipientsError) return NextResponse.json({ error: recipientsError.message }, { status: 503 });
  const legacyPhone = normalizePhone(serverEnv().authorizedTestNumber ?? "");
  const recipients = savedRecipients?.length ? savedRecipients : legacyPhone ? [{ id: "legacy", phone: legacyPhone }] : [];
  if (!recipients.length) return NextResponse.json({ error: "Cadastre pelo menos um integrante no grupo de teste" }, { status: 400 });
  const relation = message.campaigns as unknown as { whatsapp_accounts?: { instance_name?: string } } | null;
  const provider = new EvolutionProvider(relation?.whatsapp_accounts?.instance_name);
  const { data: attachments } = await admin.from("campaign_attachments").select("storage_path,file_name,mime_type").eq("campaign_id", id).order("created_at");
  const results = [];
  for (const recipient of recipients) {
    let result;
    if (attachments?.length) {
      result = { success: true } as { success: true; externalId?: string } | { success: false; error: string };
      for (let index = 0; index < attachments.length; index += 1) {
        const attachment = attachments[index]; const { data: signed } = await admin.storage.from("campaign-attachments").createSignedUrl(attachment.storage_path, 300);
        if (!signed?.signedUrl) { result = { success: false, error: "Falha ao preparar anexo" }; break; }
        result = await provider.sendMedia({ destination: recipient.phone, text: index === 0 ? `[TESTE]\n${message.mensagem}` : "", mediaUrl: signed.signedUrl, fileName: attachment.file_name, mimeType: attachment.mime_type, idempotencyKey: `test:${id}:${recipient.id}:${index}:${Date.now()}` });
        if (!result.success) break;
      }
    } else result = await provider.sendText({ destination: recipient.phone, text: `[TESTE]\n${message.mensagem}`, idempotencyKey: `test:${id}:${recipient.id}:${Date.now()}` });
    results.push(result);
  }
  const sent = results.filter((result) => result.success).length;
  const failed = results.length - sent;
  if (!failed) await auth.supabase.from("campaigns").update({ test_sent_at: new Date().toISOString(), test_sent_by: auth.userId }).eq("id", id);
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: failed ? "campaign_test_partial" : "campaign_test_sent", entityType: "campaign", entityId: id, metadata: { sent, failed } });
  return NextResponse.json(
    failed ? { error: `Teste parcial: ${sent} enviado(s) e ${failed} com falha`, sent, failed, total: results.length } : { success: true, sent, failed: 0, total: results.length },
    { status: failed ? 502 : 200 },
  );
}
