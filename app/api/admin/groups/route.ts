import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const admin = createAdminClient();
  let query = admin.from("user_groups").select("id,name,created_at").eq("organization_id", access.profile.organization_id).order("name");
  if (access.profile.role !== "master") query = query.in("id", access.groups.map((item) => item.group_id));
  const { data, error } = await query;
  return NextResponse.json(error ? { error: error.message } : { groups: data ?? [] }, { status: error ? 400 : 200 });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master"]);
  if (!access) return NextResponse.json({ error: "Somente o administrador master cria grupos" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Nome de grupo invalido" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("user_groups").insert({ name, organization_id: access.profile.organization_id, created_by: auth.userId }).select("id,name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "group_created", entityType: "group", entityId: data.id, metadata: { name } });
  return NextResponse.json({ group: data });
}
