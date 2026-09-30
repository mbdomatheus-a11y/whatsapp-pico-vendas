import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master", "admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores podem ativar a coleta de respostas" }, { status: 403 });
  const { id } = await params;
  const { data: account } = await auth.supabase.from("whatsapp_accounts").select("instance_name").eq("id", id).eq("enabled", true).maybeSingle();
  if (!account) return NextResponse.json({ error: "Conta do WhatsApp nao encontrada" }, { status: 404 });
  try {
    const appUrl = process.env.APP_URL ?? "https://whatsapp-pico-vendas.vercel.app";
    await new EvolutionProvider(account.instance_name).configureInboundWebhook(appUrl);
    return NextResponse.json({ ok: true, message: "Coleta de respostas e reacoes ativada" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel ativar a coleta" }, { status: 502 });
  }
}
