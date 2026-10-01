import { PortalShell } from "@/components/portal-shell";
import { CampaignTable } from "@/components/campaign-table";
import { getPortalContext } from "@/lib/portal";
import { suggestedCampaignName } from "@/lib/campaigns";
import { CampaignDraftForm } from "@/components/campaign-draft-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function CampaignsPage() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const admin = createAdminClient();
  const [{ data: campaigns }, { data: accounts }, { data: settings }] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,total_messages,created_at,test_sent_at,scheduled_at,confirmation_enabled,account_mode,whatsapp_account_ids").eq("group_id", selectedGroupId).is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("whatsapp_accounts").select("id,label,phone_number").eq("enabled", true).order("created_at"),
    admin.from("system_settings").select("account_rotation_batch_size").eq("organization_id", access.profile.organization_id).single(),
  ]);
  return <PortalShell active="campanhas" title="Campanhas" description="Envio imediato ou programado" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}>
    <div className="page-actions"><a className="button secondary" href="/campanhas/arquivadas">Ver arquivadas</a></div>
    <section className="panel"><div className="panel-heading"><div><h2>Campanhas ativas</h2><p>Revise, teste, autorize e somente depois inicie cada lote.</p></div></div><CampaignTable campaigns={campaigns ?? []} /></section>
    <section className="panel"><div className="panel-heading"><div><h2>Criar campanha manual</h2><p>O nome sugerido pode ser alterado livremente. Esta etapa cria apenas o rascunho.</p></div></div>
      <CampaignDraftForm defaultName={suggestedCampaignName()} groupId={selectedGroupId} accounts={accounts ?? []} messages={[{ gerente_id: "G001", telefone: "5511999999999", mensagem: "Ola, ..." }]} defaultRotationBatchSize={settings?.account_rotation_batch_size ?? 1} editableMessages/>
    </section>
  </PortalShell>;
}
