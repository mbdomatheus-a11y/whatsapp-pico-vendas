import { requireUser } from "@/lib/auth";
import { OperationControls, QueueControls } from "@/components/operation-controls";
import { CampaignPlanner } from "@/components/campaign-planner";
import { AccountsManager } from "@/components/accounts-manager";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const [{ data: campaigns }, { data: queue }, { data: health }, { data: accounts }] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,total_messages,created_at,test_sent_at,whatsapp_account_id").order("created_at", { ascending: false }).limit(20),
    supabase.from("message_queue").select("status"),
    supabase.from("gateway_health").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("whatsapp_accounts").select("id,label,instance_name").eq("enabled", true).order("created_at"),
  ]);
  const counts = (queue ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Pico de Vendas</p><h1>Central de campanhas</h1></div>
        <form action="/api/auth/logout" method="post"><button className="secondary">Sair</button></form>
      </header>
      <section className="status-grid">
        <article className="status-card"><span>Gateway</span><strong>{health?.gateway_online ? "Online" : "Offline"}</strong></article>
        <article className="status-card"><span>WhatsApp</span><strong>{health?.whatsapp_status ?? "Sem leitura"}</strong></article>
        <article className="status-card"><span>Pendentes</span><strong>{counts.pronto_para_envio ?? 0}</strong></article>
        <article className="status-card"><span>Enviadas</span><strong>{counts.enviado ?? 0}</strong></article>
      </section>
      <QueueControls />
      <AccountsManager />
      <section className="panel">
        <div className="panel-heading"><div><h2>Campanhas</h2><p>Revise, teste e autorize cada lote.</p></div><a className="button" href="#nova">Nova campanha</a></div>
        <div className="table-wrap"><table><thead><tr><th>Campanha</th><th>Status</th><th>Mensagens</th><th>Criada em</th><th>Acoes</th></tr></thead><tbody>
          {(campaigns ?? []).map((campaign) => <tr key={campaign.id}><td>{campaign.name}</td><td><span className={`badge ${campaign.status}`}>{campaign.status}</span></td><td>{campaign.total_messages}</td><td>{new Date(campaign.created_at).toLocaleString("pt-BR")}</td><td><OperationControls campaignId={campaign.id} status={campaign.status} tested={!!campaign.test_sent_at} /></td></tr>)}
          {!campaigns?.length && <tr><td colSpan={5} className="empty">Nenhuma campanha criada.</td></tr>}
        </tbody></table></div>
      </section>
      <CampaignPlanner accounts={(accounts ?? []).map(({ id, label }) => ({ id, label }))} />
      <section className="panel" id="nova">
        <div className="panel-heading"><div><h2>Nova campanha</h2><p>Cole uma lista JSON para criar um rascunho. Nenhuma mensagem sera enviada.</p></div></div>
        <form action="/api/campaigns" method="post" className="stack">
          <label>Conta de envio<select name="accountId" required>{(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
          <label>Nome<input name="name" required placeholder="Pico de vendas 28/09" /></label>
          <label>Mensagens<textarea name="messages" rows={8} required defaultValue={'[{"gerente_id":"G001","telefone":"5511999999999","mensagem":"Ola, ..."}]'} /></label>
          <button type="submit">Criar rascunho</button>
        </form>
      </section>
    </main>
  );
}
