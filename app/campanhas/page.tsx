import { PortalShell } from "@/components/portal-shell";
import { CampaignTable } from "@/components/campaign-table";
import { getPortalContext } from "@/lib/portal";
import { suggestedCampaignName } from "@/lib/campaigns";
import { SubmitButton } from "@/components/submit-button";

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
      <form action="/api/campaigns" method="post" encType="multipart/form-data" className="stack">
        <label>Conta de envio<select name="accountId" required>{(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
        <label>Nome<input name="name" required defaultValue={suggestedCampaignName()} /></label><input type="hidden" name="groupId" value={selectedGroupId} />
        <label>Mensagens<textarea name="messages" rows={8} required defaultValue={'[{"gerente_id":"G001","telefone":"5511999999999","mensagem":"Ola, ..."}]'} /></label>
        <label className="check"><input type="checkbox" name="confirmationEnabled" />Incluir link individual de confirmacao de recebimento</label>
        <label>Agendar para, opcional<input type="datetime-local" name="scheduledAt" /></label>
        <label>Anexos, ate 1 PDF e 3 imagens<input type="file" name="attachments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple /></label>
        <label className="check warning"><input type="checkbox" name="riskAccepted" />Confirmo o fracionamento se houver mais de 250 destinatarios.</label>
        <SubmitButton idle="Criar rascunho" pending="Criando rascunho..." />
      </form>
    </section>
  </PortalShell>;
}
