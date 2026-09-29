import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@/lib/messaging/evolution";

const BATCH_SIZE = 10;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await params;
  const { data: campaign } = await auth.supabase.from("campaigns").select("id,status,created_by").eq("id", id).eq("created_by", auth.userId).single();
  if (!campaign || !["autorizada", "processando"].includes(campaign.status)) return NextResponse.json({ error: "A campanha precisa estar autorizada para iniciar os envios" }, { status: 409 });

  const admin = createAdminClient();
  let processed = 0; let sent = 0; let failed = 0;
  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const { data, error } = await admin.rpc("claim_campaign_message", { target_campaign: id });
    if (error) return NextResponse.json({ error: error.message, processed, sent, failed }, { status: 500 });
    const claimed = Array.isArray(data) ? data[0] : data;
    if (!claimed) break;
    const result = await new EvolutionProvider(claimed.instance_name).sendText({ destination: claimed.telefone, text: claimed.mensagem, idempotencyKey: claimed.idempotency_key });
    await admin.rpc("finish_message", { target_id: claimed.id, was_success: result.success, provider_id: result.success ? result.externalId ?? null : null, error_text: result.success ? null : result.error });
    processed += 1; if (result.success) sent += 1; else failed += 1;
    if (index < BATCH_SIZE - 1) await wait(800);
  }
  const { count: remaining } = await admin.from("message_queue").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pronto_para_envio");
  return NextResponse.json({ processed, sent, failed, remaining: remaining ?? 0, complete: (remaining ?? 0) === 0 });
}
