import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBrazilianPhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores gerenciam contas" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  const phoneNumber = normalizeBrazilianPhone(String(body.phoneNumber ?? ""));
  if (!label || label.length > 60 || !phoneNumber) return NextResponse.json({ error: "Informe um nome e um numero brasileiro valido com DDD" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("whatsapp_accounts").update({ label, phone_number: phoneNumber }).eq("id", id).eq("organization_id", auth.access.profile.organization_id).eq("enabled", true).select("id,label,phone_number,instance_name").maybeSingle();
  if (error?.code === "23505") return NextResponse.json({ error: "Este numero ja identifica outra conta" }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Conta nao encontrada" }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "whatsapp_account_updated", entityType: "whatsapp_account", entityId: id, metadata: { label, phoneSuffix: phoneNumber.slice(-4) } });
  return NextResponse.json({ account: data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores gerenciam contas" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_accounts").select("instance_name,label").eq("id", id).eq("organization_id", auth.access.profile.organization_id).eq("enabled", true).single();
  if (!data) return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 });
  const { count: total } = await admin.from("whatsapp_accounts").select("id", { count: "exact", head: true }).eq("organization_id", auth.access.profile.organization_id).eq("enabled", true);
  if ((total ?? 0) <= 1) return NextResponse.json({ error: "Mantenha pelo menos uma conta cadastrada" }, { status: 400 });
  try {
    await new EvolutionProvider(data.instance_name).deleteInstance();
    const { error } = await admin.from("whatsapp_accounts").update({ enabled: false }).eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "whatsapp_account_removed", entityType: "whatsapp_account", entityId: id, metadata: { label: data.label } });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao remover conta" }, { status: 400 }); }
}
