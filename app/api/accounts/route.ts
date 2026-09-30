import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { data, error } = await auth.supabase.from("whatsapp_accounts").select("id,label,instance_name,enabled,created_at").order("created_at");
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
  const { count } = await auth.supabase.from("whatsapp_accounts").select("id", { count: "exact", head: true }).eq("enabled", true);
  if ((count ?? 0) >= 2) return NextResponse.json({ error: "O portal permite no maximo dois numeros" }, { status: 400 });
  try {
    await new EvolutionProvider(instanceName).createInstance();
    const { data, error } = await auth.supabase.from("whatsapp_accounts").insert({ label, instance_name: instanceName, created_by: auth.userId, organization_id: auth.access.profile.organization_id }).select("id,label,instance_name,enabled").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ account: data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar conta" }, { status: 400 }); }
}
