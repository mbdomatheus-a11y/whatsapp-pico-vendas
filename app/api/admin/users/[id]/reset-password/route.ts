import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: target } = await admin.from("user_profiles").select("role,organization_id").eq("user_id", id).single();
  if (!target || target.role === "master" || target.organization_id !== access.profile.organization_id) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  if (access.profile.role !== "master") {
    const { data: targetGroups } = await admin.from("user_group_memberships").select("group_id").eq("user_id", id);
    const allowed = new Set(access.groups.map((item) => item.group_id));
    if (!(targetGroups ?? []).some((item) => allowed.has(item.group_id))) return NextResponse.json({ error: "Usuario fora dos seus grupos" }, { status: 403 });
  }
  const password = `Tmp@${randomBytes(9).toString("base64url")}9a`;
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("user_profiles").update({ must_change_password: true }).eq("user_id", id);
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "password_reset", entityType: "user", entityId: id });
  return NextResponse.json({ temporaryPassword: password });
}
