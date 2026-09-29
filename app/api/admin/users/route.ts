import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { MASTER_EMAIL, requireRole, type UserRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

function temporaryPassword() {
  return `Tmp@${randomBytes(9).toString("base64url")}9a`;
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: authUsers }, { data: profiles }, { data: memberships }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("user_profiles").select("user_id,full_name,phone,role,active,organization_id,must_change_password").eq("organization_id", access.profile.organization_id).neq("role", "master"),
    admin.from("user_group_memberships").select("user_id,group_id,user_groups(name)"),
  ]);
  const allowedGroups = new Set(access.groups.map((item) => item.group_id));
  const users = (profiles ?? []).filter((profile) => access.profile.role === "master" || (memberships ?? []).some((member) => member.user_id === profile.user_id && allowedGroups.has(member.group_id))).map((profile) => {
    const user = authUsers?.users.find((item) => item.id === profile.user_id);
    const { phone, ...safeProfile } = profile;
    return { ...safeProfile, maskedPhone: phone ? `********${phone.slice(-4)}` : "", email: user?.email, groups: (memberships ?? []).filter((item) => item.user_id === profile.user_id).map((item) => ({ id: item.group_id, name: (item.user_groups as unknown as { name?: string } | null)?.name })) };
  }).filter((user) => user.email?.toLowerCase() !== MASTER_EMAIL);
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  const role = String(body.role ?? "consulta") as UserRole;
  const groupIds = Array.isArray(body.groupIds) ? body.groupIds.map(String) : [];
  if (!email.endsWith("@pernambucanas.com.br") || !fullName || !phone || !["admin", "operador", "consulta"].includes(role) || !groupIds.length) return NextResponse.json({ error: "Preencha e-mail corporativo, nome, celular, perfil e grupo" }, { status: 400 });
  const allowed = new Set(access.groups.map((item) => item.group_id));
  if (access.profile.role !== "master" && groupIds.some((id: string) => !allowed.has(id))) return NextResponse.json({ error: "Grupo fora da sua administracao" }, { status: 403 });
  const password = temporaryPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: fullName, phone } });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Falha ao criar usuario" }, { status: 400 });
  await admin.from("user_profiles").update({ full_name: fullName, phone, role, organization_id: access.profile.organization_id, active: true, must_change_password: true }).eq("user_id", data.user.id);
  await admin.from("user_group_memberships").insert(groupIds.map((groupId: string) => ({ user_id: data.user!.id, group_id: groupId, created_by: auth.userId })));
  await admin.from("user_preferences").upsert({ user_id: data.user.id, selected_group_id: groupIds[0] });
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "user_created", entityType: "user", entityId: data.user.id, metadata: { role, groups: groupIds } });
  return NextResponse.json({ userId: data.user.id, temporaryPassword: password });
}
