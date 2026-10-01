import { PortalShell } from "@/components/portal-shell";
import { CampaignPlanner } from "@/components/campaign-planner";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanningSessionList } from "@/components/planning-session-list";

export const dynamic = "force-dynamic";
export default async function PlanningPage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const [{ data: accounts }, { data: sessions }, { data: settings }] = await Promise.all([
    supabase.from("whatsapp_accounts").select("id,label,phone_number").eq("enabled", true).order("created_at"),
    createAdminClient().from("planning_sessions").select("id,name,weekday,status,source_file_name,segmentation_file_name,updated_at,expires_at").eq("group_id", selectedGroupId).order("updated_at", { ascending: false }).limit(50),
    createAdminClient().from("system_settings").select("account_rotation_batch_size").eq("organization_id", access.profile.organization_id).single(),
  ]);
  return <PortalShell active="planejamento" title="Preparar envio" description="Importar, salvar e continuar depois" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><CampaignPlanner accounts={accounts ?? []} groupId={selectedGroupId} defaultRotationBatchSize={settings?.account_rotation_batch_size ?? 1}/><PlanningSessionList sessions={sessions ?? []} /></PortalShell>;
}
