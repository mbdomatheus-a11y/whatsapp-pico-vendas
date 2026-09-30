import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) { return typeof value === "string" ? value : ""; }

function validSecret(received: string | null) {
  if (!received) return false;
  const expected = Buffer.from(serverEnv().evolutionApiKey);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function senderFrom(data: JsonObject) {
  const key = object(data.key);
  const candidates = [key.remoteJidAlt, data.sender, key.remoteJid].map(text);
  const jid = candidates.find((item) => item.includes("@s.whatsapp.net")) ?? candidates.find(Boolean) ?? "";
  const local = jid.split("@")[0].replace(/\D/g, "");
  return local.length >= 10 && local.length <= 15 ? local : "";
}

function messageDetails(data: JsonObject) {
  const message = object(data.message);
  const reaction = object(message.reactionMessage);
  if (Object.keys(reaction).length) return {
    eventType: "reacao" as const,
    content: text(reaction.text) || "Reacao removida",
    referencedProviderId: text(object(reaction.key).id),
  };
  const extended = object(message.extendedTextMessage);
  const content = text(message.conversation)
    || text(extended.text)
    || text(object(message.imageMessage).caption)
    || text(object(message.videoMessage).caption)
    || (message.imageMessage ? "[Imagem recebida]" : "")
    || (message.audioMessage ? "[Audio recebido]" : "")
    || (message.documentMessage ? "[Documento recebido]" : "")
    || (message.stickerMessage ? "[Figurinha recebida]" : "")
    || "[Mensagem recebida]";
  return {
    eventType: "mensagem" as const,
    content: content.slice(0, 4000),
    referencedProviderId: text(object(extended.contextInfo).stanzaId),
  };
}

export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-api-key"))) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Evento invalido" }, { status: 400 });
  const root = object(payload);
  const event = text(root.event).toLowerCase();
  if (event && !["messages.upsert", "messages_upsert"].includes(event)) return NextResponse.json({ ok: true, ignored: "evento" });
  const data = object(root.data);
  const key = object(data.key);
  if (key.fromMe === true) return NextResponse.json({ ok: true, ignored: "mensagem_propria" });
  const sender = senderFrom(data);
  const instanceName = text(root.instance) || text(object(root.instance).instanceName) || text(data.instanceName);
  if (!sender || !instanceName) return NextResponse.json({ ok: true, ignored: "sem_remetente" });

  const admin = createAdminClient();
  const { data: account } = await admin.from("whatsapp_accounts").select("id,organization_id").eq("instance_name", instanceName).eq("enabled", true).maybeSingle();
  if (!account) return NextResponse.json({ ok: true, ignored: "conta_desconhecida" });
  const senderHash = createHash("sha256").update(sender).digest("hex");
  const details = messageDetails(data);
  const recentCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const baseMatch = () => admin.from("message_queue")
    .select("id,campaign_id,enviado_em,campaigns!inner(group_id,whatsapp_account_id)")
    .eq("destination_hash", senderHash)
    .eq("campaigns.whatsapp_account_id", account.id)
    .gte("enviado_em", recentCutoff)
    .order("enviado_em", { ascending: false }).limit(1);
  let matched = null;
  if (details.referencedProviderId) {
    const result = await baseMatch().eq("external_id", details.referencedProviderId).maybeSingle();
    matched = result.data;
  }
  if (!matched) {
    const result = await baseMatch().maybeSingle();
    matched = result.data;
  }
  if (!matched) return NextResponse.json({ ok: true, ignored: "fora_de_campanha" });
  const campaign = matched.campaigns as unknown as { group_id: string };
  const providerEventId = text(key.id) || createHash("sha256").update(JSON.stringify(root)).digest("hex");
  const receivedAt = typeof data.messageTimestamp === "number"
    ? new Date(data.messageTimestamp * 1000).toISOString()
    : new Date().toISOString();
  const { data: settings } = await admin.from("system_settings").select("retention_days").eq("organization_id", account.organization_id).maybeSingle();
  const retention = settings?.retention_days ?? 30;
  const { error } = await admin.from("inbound_events").upsert({
    organization_id: account.organization_id,
    group_id: campaign.group_id,
    campaign_id: matched.campaign_id,
    matched_message_id: matched.id,
    event_type: details.eventType,
    sender_hash: senderHash,
    sender_masked: `********${sender.slice(-4)}`,
    content: details.content,
    instance_name: instanceName,
    provider_event_id: providerEventId,
    received_at: receivedAt,
    expires_at: retention === 0 ? null : new Date(Date.now() + retention * 86400000).toISOString(),
  }, { onConflict: "instance_name,provider_event_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Nao foi possivel registrar o retorno" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
