import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

type InputMessage = { gerente_id: string; telefone: string; mensagem: string };
const phonePattern = /^\d{10,15}$/;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const accountId = String(form.get("accountId") ?? "").trim();
  let messages: InputMessage[];
  try { messages = JSON.parse(String(form.get("messages") ?? "[]")); } catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }
  if (!name || !accountId || !Array.isArray(messages) || !messages.length || messages.length > 500) return NextResponse.json({ error: "Campanha invalida" }, { status: 400 });
  if (messages.some((m) => !m.gerente_id || !phonePattern.test(m.telefone) || !m.mensagem?.trim())) return NextResponse.json({ error: "Mensagem invalida" }, { status: 400 });

  const { data: account } = await auth.supabase.from("whatsapp_accounts").select("id").eq("id", accountId).eq("enabled", true).single();
  if (!account) return NextResponse.json({ error: "Conta de envio invalida" }, { status: 400 });
  const { data: campaign, error } = await auth.supabase.from("campaigns").insert({ name, created_by: auth.userId, total_messages: messages.length, whatsapp_account_id: accountId }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = messages.map((m, index) => ({
    campaign_id: campaign.id, gerente_id: m.gerente_id, telefone: m.telefone,
    mensagem: m.mensagem.trim(), sequence_number: index + 1,
    idempotency_key: `${campaign.id}:${m.gerente_id}:${m.telefone}`,
  }));
  const { error: queueError } = await auth.supabase.from("message_queue").insert(rows);
  if (queueError) return NextResponse.json({ error: queueError.message }, { status: 400 });
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
