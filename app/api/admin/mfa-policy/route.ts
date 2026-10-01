import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master"]);
  if (!access) return NextResponse.json({ error: "Somente o administrador master consulta esta configuracao" }, { status: 403 });
  const { data, error } = await createAdminClient().from("system_settings").select("mfa_required").eq("organization_id", access.profile.organization_id).single();
  return NextResponse.json(error ? { error: "Nao foi possivel consultar a politica de 2FA" } : { required: data.mfa_required }, { status: error ? 500 : 200 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master"]);
  if (!access) return NextResponse.json({ error: "Somente o administrador master altera a exigencia de 2FA" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.required !== "boolean") return NextResponse.json({ error: "Configuracao de 2FA invalida" }, { status: 400 });
  const { error } = await createAdminClient().from("system_settings").update({ mfa_required: body.required, updated_by: auth.userId, updated_at: new Date().toISOString() }).eq("organization_id", access.profile.organization_id);
  if (error) return NextResponse.json({ error: "Nao foi possivel alterar a exigencia de 2FA" }, { status: 500 });
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: body.required ? "mfa_policy_enabled" : "mfa_policy_disabled", entityType: "security_settings", metadata: { required: body.required } });
  return NextResponse.json({ ok: true, required: body.required });
}
