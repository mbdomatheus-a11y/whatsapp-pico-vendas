import { campaignStage } from "@/lib/campaigns";
import { OperationControls } from "@/components/operation-controls";
import { ScheduleEditor } from "@/components/schedule-editor";
import { CampaignManagement } from "@/components/campaign-management";

type Campaign = { id: string; name: string; status: string; total_messages: number; created_at: string; test_sent_at?: string | null; scheduled_at?: string | null; confirmation_enabled?: boolean; account_mode?: string; whatsapp_account_ids?: string[] };

export function CampaignTable({ campaigns, archived = false }: { campaigns: Campaign[]; archived?: boolean }) {
  return <div className="campaign-list">
    {campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}>
      <div className="campaign-card-main"><div><h3>{campaign.name}</h3><p className="muted">{campaign.total_messages} mensagens · criada em {new Date(campaign.created_at).toLocaleString("pt-BR")}</p></div><span className={`badge ${campaign.status}`}>{archived ? "Arquivada" : campaignStage(campaign.status, !!campaign.test_sent_at, campaign.scheduled_at)}</span></div>
      {campaign.confirmation_enabled && <p className="muted">Inclui confirmacao de leitura</p>}
      <p className="muted">Envio: {campaign.account_mode === "round_robin" ? `alternado entre ${campaign.whatsapp_account_ids?.length ?? 0} numeros` : "um unico numero"}</p>
      {!archived && <OperationControls campaignId={campaign.id} status={campaign.status} tested={!!campaign.test_sent_at} totalMessages={campaign.total_messages} scheduledAt={campaign.scheduled_at} />}
      {!archived && !!campaign.scheduled_at && ["rascunho","autorizada"].includes(campaign.status) && <ScheduleEditor campaignId={campaign.id} scheduledAt={campaign.scheduled_at} />}
      <CampaignManagement campaignId={campaign.id} campaignName={campaign.name} archived={archived} />
    </article>)}
    {!campaigns.length && <p className="empty">Nenhuma campanha nesta area.</p>}
  </div>;
}
