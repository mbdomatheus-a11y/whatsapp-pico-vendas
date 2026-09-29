import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const { data: target } = await admin.from("user_profiles").select("role,organization_id").eq("user_id", id).single();
  if (!target || target.role === "master" || target.organization_id !== access.profile.organization_id) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  if (access.profile.role !== "master") {
    const { data: targetGroups } = await admin.from("user_group_memberships").select("group_id").eq("user_id", id);
    const allowed = new Set(access.groups.map((item) => item.group_id));
    if (!(targetGroups ?? []).some((item) => allowed.has(item.group_id))) return NextResponse.json({ error: "Usuario fora dos seus grupos" }, { status: 403 });
  }
  const role = ["admin", "operador", "consulta"].includes(body.role) ? body.role : target.role;
  await admin.from("user_profiles").update({ role, active: body.active !== false }).eq("user_id", id);
  if (Array.isArray(body.groupIds) && body.groupIds.length) {
    const allowed = new Set(access.groups.map((item) => item.group_id));
    if (access.profile.role !== "master" && body.groupIds.some((groupId: string) => !allowed.has(groupId))) return NextResponse.json({ error: "Grupo fora da sua administracao" }, { status: 403 });
    await admin.from("user_group_memberships").delete().eq("user_id", id);
    await admin.from("user_group_memberships").insert(body.groupIds.map((groupId: string) => ({ user_id: id, group_id: groupId, created_by: auth.userId })));
  }
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "user_updated", entityType: "user", entityId: id, metadata: { role, active: body.active !== false } });
  return NextResponse.json({ ok: true });
}
