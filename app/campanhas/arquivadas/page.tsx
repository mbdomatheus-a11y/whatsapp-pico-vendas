import { PortalShell } from "@/components/portal-shell";
import { CampaignTable } from "@/components/campaign-table";
import { getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";
export default async function ArchivedCampaignsPage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const { data: campaigns } = await supabase.from("campaigns").select("id,name,status,total_messages,created_at,test_sent_at,scheduled_at,confirmation_enabled").eq("group_id", selectedGroupId).not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(100);
  return <PortalShell active="campanhas" title="Campanhas arquivadas" description="Consulta e recuperacao" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><div className="page-actions"><a className="button secondary" href="/campanhas">Voltar para campanhas</a></div><section className="panel"><CampaignTable campaigns={campaigns ?? []} archived /></section></PortalShell>;
}
