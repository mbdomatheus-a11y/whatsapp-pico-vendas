import { createAdminClient } from "@/lib/supabase/admin";

export const MASTER_EMAIL = "matheus.oliveira@pernambucanas.com.br";
export type UserRole = "master" | "admin" | "operador" | "consulta";

export async function getAccessContext(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("user_id,full_name,phone,role,organization_id,active,must_change_password").eq("user_id", userId).single();
  if (!profile?.active || !profile.organization_id) return null;
  let groups: Array<{ group_id: string; user_groups: { name?: string } | null }> = [];
  if (profile.role === "master") {
    const { data } = await admin.from("user_groups").select("id,name").eq("organization_id", profile.organization_id).order("name");
    groups = (data ?? []).map((group) => ({ group_id: String(group.id), user_groups: { name: String(group.name) } }));
  } else {
    const { data } = await admin.from("user_group_memberships").select("group_id,user_groups(name)").eq("user_id", userId);
    groups = (data ?? []).map((membership) => {
      const related = membership.user_groups as unknown as { name?: string } | null;
      return { group_id: String(membership.group_id), user_groups: related ? { name: related.name } : null };
    });
  }
  const { data: preference } = await admin.from("user_preferences").select("selected_group_id,preferences").eq("user_id", userId).maybeSingle();
  return { profile: profile as typeof profile & { role: UserRole }, groups, preference };
}

export async function requireRole(userId: string, roles: UserRole[]) {
  const context = await getAccessContext(userId);
  return context && roles.includes(context.profile.role) ? context : null;
}
