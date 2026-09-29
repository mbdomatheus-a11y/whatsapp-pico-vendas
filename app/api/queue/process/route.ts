import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function POST() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data: item, error } = await admin.rpc("claim_next_message");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const claimed = Array.isArray(item) ? item[0] : item;
  if (!claimed) return NextResponse.json({ processed: false, reason: "Fila vazia ou pausada" });
  const result = await new EvolutionProvider().sendText({ destination: claimed.telefone, text: claimed.mensagem, idempotencyKey: claimed.idempotency_key });
  await admin.rpc("finish_message", { target_id: claimed.id, was_success: result.success, provider_id: result.success ? result.externalId ?? null : null, error_text: result.success ? null : result.error });
  return NextResponse.json({ processed: true, id: claimed.id, result }, { status: result.success ? 200 : 502 });
}
