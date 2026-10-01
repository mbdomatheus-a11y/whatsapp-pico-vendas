import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { data, error } = await auth.supabase.from("whatsapp_accounts").select("id,label,instance_name,enabled,created_at").eq("enabled", true).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const accounts = await Promise.all((data ?? []).map(async (account) => {
    const provider = new EvolutionProvider(account.instance_name);
    const [health, webhook] = await Promise.all([provider.health(), provider.webhookStatus()]);
    return { ...account, health, webhook };
  }));
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores gerenciam contas" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  const instanceName = String(body.instanceName ?? "").trim();
  if (!label || !/^[a-zA-Z0-9_-]{2,60}$/.test(instanceName)) return NextResponse.json({ error: "Nome ou identificador invalido" }, { status: 400 });
  const { data: existing } = await auth.supabase.from("whatsapp_accounts").select("id,label,enabled").eq("instance_name", instanceName).maybeSingle();
  if (existing?.enabled) return NextResponse.json({ error: `O identificador ${instanceName} ja pertence a conta ativa ${existing.label}. Use outro identificador.` }, { status: 409 });
  const { count } = await auth.supabase.from("whatsapp_accounts").select("id", { count: "exact", head: true }).eq("enabled", true);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "O portal permite no maximo 10 numeros ativos" }, { status: 400 });
  try {
    const provider = new EvolutionProvider(instanceName);
    await provider.ensureInstance();
    const accountWrite = existing
      ? auth.supabase.from("whatsapp_accounts").update({ label, enabled: true, created_by: auth.userId }).eq("id", existing.id)
      : auth.supabase.from("whatsapp_accounts").insert({ label, instance_name: instanceName, created_by: auth.userId, organization_id: auth.access.profile.organization_id });
    const { data, error } = await accountWrite.select("id,label,instance_name,enabled").single();
    if (error) throw new Error(error.message);
    try {
      const connection = await provider.connect();
      return NextResponse.json({ account: data, qr: connection.base64 ?? connection.qrcode?.base64 ?? null, pairingCode: connection.pairingCode ?? null });
    } catch (connectionError) {
      return NextResponse.json({ account: data, warning: connectionError instanceof Error ? connectionError.message : "Conta criada, mas o QR Code nao ficou disponivel" });
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar conta" }, { status: 400 }); }
}
