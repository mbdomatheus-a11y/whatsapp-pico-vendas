import { PortalShell } from "@/components/portal-shell";
import { CampaignPlanner } from "@/components/campaign-planner";
import { getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";
export default async function PlanningPage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const { data: accounts } = await supabase.from("whatsapp_accounts").select("id,label").eq("enabled", true).order("created_at");
  return <PortalShell active="planejamento" title="Preparar envio" description="Planilhas, segmentacao e previa" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><CampaignPlanner accounts={accounts ?? []} groupId={selectedGroupId} /></PortalShell>;
}
