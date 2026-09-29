import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master"]);
  if (!access) return NextResponse.json({ error: "Somente o administrador master redefine o 2FA" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: target } = await admin.from("user_profiles").select("role,organization_id").eq("user_id", id).single();
  if (!target || target.role === "master" || target.organization_id !== access.profile.organization_id) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  for (const factor of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: id, id: factor.id });
  await admin.from("user_profiles").update({ mfa_reset_at: new Date().toISOString() }).eq("user_id", id);
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "mfa_reset", entityType: "user", entityId: id });
  return NextResponse.json({ ok: true });
}
