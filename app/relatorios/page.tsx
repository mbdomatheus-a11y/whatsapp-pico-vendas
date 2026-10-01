import { PortalShell } from "@/components/portal-shell";
import { ReportsManager } from "@/components/reports-manager";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function ReportsPage() {
  const { access, groups, selectedGroupId } = await getPortalContext();
  const admin = createAdminClient(); const groupIds = groups.map((group) => group.id);
  const [{ data: campaigns }, { data: profiles }] = await Promise.all([
    admin.from("campaigns").select("id,name,group_id").in("group_id", groupIds).order("created_at", { ascending: false }).limit(1000),
    admin.from("user_profiles").select("user_id,full_name").eq("organization_id", access.profile.organization_id).order("full_name"),
  ]);
  return <PortalShell active="relatorios" title="Relatorios" description="Auditoria, resultados e exportacoes" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><ReportsManager groups={groups} campaigns={(campaigns ?? []).map((item) => ({ id:item.id,name:item.name,group_id:item.group_id }))} users={(profiles ?? []).map((item) => ({ id:item.user_id,name:item.full_name ?? "Usuario" }))}/></PortalShell>;
}
