import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores gerenciam contas" }, { status: 403 });
  const { id } = await params;
  const { data } = await auth.supabase.from("whatsapp_accounts").select("instance_name").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 });
  try {
    const result = await new EvolutionProvider(data.instance_name).connect();
    return NextResponse.json({ qr: result.base64 ?? result.qrcode?.base64 ?? null, pairingCode: result.pairingCode ?? null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao conectar" }, { status: 400 }); }
}
