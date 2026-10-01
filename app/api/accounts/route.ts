import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { createAdminClient } from "@/lib/supabase/admin";
import { instanceNameFromPhone, normalizeBrazilianPhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { data, error } = await createAdminClient().from("whatsapp_accounts").select("id,label,phone_number,instance_name,enabled,created_at").eq("organization_id", auth.access.profile.organization_id).eq("enabled", true).order("created_at");
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
  const phoneNumber = normalizeBrazilianPhone(String(body.phoneNumber ?? ""));
  if (!label || label.length > 60 || !phoneNumber) return NextResponse.json({ error: "Informe um nome e um numero brasileiro valido com DDD" }, { status: 400 });
  const admin = createAdminClient();
  const instanceName = instanceNameFromPhone(phoneNumber);
  const { data: phoneOwner } = await admin.from("whatsapp_accounts").select("id,label,enabled,instance_name").eq("organization_id", auth.access.profile.organization_id).eq("phone_number", phoneNumber).maybeSingle();
  const { data: legacyAccount } = await admin.from("whatsapp_accounts").select("id,label,enabled,instance_name").eq("organization_id", auth.access.profile.organization_id).eq("instance_name", String(body.legacyInstanceName ?? "")).maybeSingle();
  const existing = phoneOwner ?? legacyAccount;
  if (existing?.enabled) return NextResponse.json({ error: `O identificador ${instanceName} ja pertence a conta ativa ${existing.label}. Use outro identificador.` }, { status: 409 });
  const { count } = await admin.from("whatsapp_accounts").select("id", { count: "exact", head: true }).eq("organization_id", auth.access.profile.organization_id).eq("enabled", true);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "O portal permite no maximo 10 numeros ativos" }, { status: 400 });
  try {
    const accountWrite = existing
      ? admin.from("whatsapp_accounts").update({ label, phone_number: phoneNumber, enabled: true, created_by: auth.userId }).eq("id", existing.id)
      : admin.from("whatsapp_accounts").insert({ label, phone_number: phoneNumber, instance_name: instanceName, created_by: auth.userId, organization_id: auth.access.profile.organization_id });
    const { data, error } = await accountWrite.select("id,label,phone_number,instance_name,enabled").single();
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: existing ? "whatsapp_account_reactivated" : "whatsapp_account_created", entityType: "whatsapp_account", entityId: data.id, metadata: { label, phoneSuffix: phoneNumber.slice(-4) } });
    try {
      const connection = await new EvolutionProvider(instanceName).prepareConnection();
      const result = connection.result;
      return NextResponse.json({ account: data, qr: result.base64 ?? result.qrcode?.base64 ?? null, pairingCode: result.pairingCode ?? null });
    } catch (connectionError) {
      return NextResponse.json({ account: data, warning: connectionError instanceof Error ? connectionError.message : "A instancia ainda nao respondeu. Use Conectar / QR novamente." }, { status: 201 });
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar conta" }, { status: 400 }); }
}
