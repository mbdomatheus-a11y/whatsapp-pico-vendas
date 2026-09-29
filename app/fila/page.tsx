import { PortalShell } from "@/components/portal-shell";
import { QueueMonitor } from "@/components/queue-monitor";
import { CommunicationLog } from "@/components/communication-log";
import { getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";
export default async function QueuePage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const { data: campaigns } = await supabase.from("campaigns").select("id,name").eq("group_id", selectedGroupId).order("created_at", { ascending: false }).limit(200);
  return <PortalShell active="fila" title="Fila e historico" description="Andamento, sucesso e confirmacoes" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><QueueMonitor campaigns={campaigns ?? []} /><CommunicationLog groupId={selectedGroupId} /></PortalShell>;
}
