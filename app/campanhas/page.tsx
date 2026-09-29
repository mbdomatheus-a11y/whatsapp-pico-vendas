import { PortalShell } from "@/components/portal-shell";
import { CampaignTable } from "@/components/campaign-table";
import { getPortalContext } from "@/lib/portal";
import { suggestedCampaignName } from "@/lib/campaigns";
import { CampaignDraftForm } from "@/components/campaign-draft-form";

export const dynamic = "force-dynamic";
export default async function CampaignsPage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const [{ data: campaigns }, { data: accounts }] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,total_messages,created_at,test_sent_at,scheduled_at,confirmation_enabled").eq("group_id", selectedGroupId).is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("whatsapp_accounts").select("id,label").eq("enabled", true).order("created_at"),
  ]);
  return <PortalShell active="campanhas" title="Campanhas" description="Envio imediato ou programado" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}>
    <div className="page-actions"><a className="button secondary" href="/campanhas/arquivadas">Ver arquivadas</a></div>
    <section className="panel"><div className="panel-heading"><div><h2>Campanhas ativas</h2><p>Revise, teste, autorize e somente depois inicie cada lote.</p></div></div><CampaignTable campaigns={campaigns ?? []} /></section>
    <section className="panel"><div className="panel-heading"><div><h2>Criar campanha manual</h2><p>O nome sugerido pode ser alterado livremente. Esta etapa cria apenas o rascunho.</p></div></div>
      <CampaignDraftForm defaultName={suggestedCampaignName()} groupId={selectedGroupId} accounts={accounts ?? []} messages={[{ gerente_id: "G001", telefone: "5511999999999", mensagem: "Ola, ..." }]} editableMessages/>
    </section>
  </PortalShell>;
}
