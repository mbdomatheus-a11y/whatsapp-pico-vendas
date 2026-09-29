import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { EvolutionProvider } from "@/lib/messaging/evolution";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const env = serverEnv();
  if (!env.authorizedTestNumber) return NextResponse.json({ error: "AUTHORIZED_TEST_NUMBER ausente" }, { status: 503 });
  const { data: message, error } = await auth.supabase.from("message_queue").select("mensagem").eq("campaign_id", id).order("sequence_number").limit(1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const result = await new EvolutionProvider().sendText({ destination: env.authorizedTestNumber, text: `[TESTE]\n${message.mensagem}`, idempotencyKey: `test:${id}:${Date.now()}` });
  if (result.success) await auth.supabase.from("campaigns").update({ test_sent_at: new Date().toISOString(), test_sent_by: auth.userId }).eq("id", id);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
