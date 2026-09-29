import { requireUser } from "@/lib/auth";
import { OperationControls, QueueControls } from "@/components/operation-controls";
import { CampaignPlanner } from "@/components/campaign-planner";
import { AccountsManager } from "@/components/accounts-manager";
import { QueueMonitor } from "@/components/queue-monitor";
import { TestGroupManager } from "@/components/test-group-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroupSelector } from "@/components/group-selector";
import { SettingsManager } from "@/components/settings-manager";
import { AuditLog } from "@/components/audit-log";
import { ScheduleEditor } from "@/components/schedule-editor";
import { SchedulerRunner } from "@/components/scheduler-runner";
import { CommunicationLog } from "@/components/communication-log";
import { MaintenanceRunner } from "@/components/maintenance-runner";

function campaignStage(status: string, tested: boolean, scheduledAt?: string | null) {
  if (status === "rascunho" && !tested) return "1. Aguardando teste";
  if (status === "rascunho" && tested) return "2. Aguardando autorização";
  if (status === "autorizada" && scheduledAt && new Date(scheduledAt).getTime() > Date.now()) return `3. Agendada para ${new Date(scheduledAt).toLocaleString("pt-BR")}`;
  if (status === "autorizada") return "3. Autorizada, pronta para iniciar";
  if (status === "processando") return "4. Envios em andamento";
  if (status === "pausada") return "Pausada";
  if (status === "concluida") return "Concluída";
  if (status === "erro") return "Concluída com erros";
  return status;
}

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase, access } = await requireUser();
  const groups = access.groups.map((item) => ({ id: item.group_id, name: (item.user_groups as unknown as { name?: string } | null)?.name ?? "Grupo" }));
  const selectedGroupId = (access.preference?.selected_group_id && groups.some((group) => group.id === access.preference?.selected_group_id) ? access.preference.selected_group_id : groups[0]?.id) ?? "";
  const admin = createAdminClient(); const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const [{ data: campaigns }, { data: queue }, { data: health }, { data: accounts }, { count: confirmedToday }, { count: sentToday }, { count: repliesToday }, { count: reactionsToday }] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,total_messages,created_at,test_sent_at,whatsapp_account_id,scheduled_at,confirmation_enabled").eq("group_id", selectedGroupId).order("created_at", { ascending: false }).limit(20),
    supabase.from("message_queue").select("status"),
    supabase.from("gateway_health").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("whatsapp_accounts").select("id,label,instance_name").eq("enabled", true).order("created_at"),
    admin.from("read_confirmations").select("id,campaigns!inner(group_id)", { count: "exact", head: true }).eq("campaigns.group_id", selectedGroupId).gte("confirmed_at", startOfDay.toISOString()),
    admin.from("communication_logs").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).gte("sent_at", startOfDay.toISOString()),
    admin.from("inbound_events").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).eq("event_type", "mensagem").gte("received_at", startOfDay.toISOString()),
    admin.from("inbound_events").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).eq("event_type", "reacao").gte("received_at", startOfDay.toISOString()),
  ]);
  const counts = (queue ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="app-shell">
      <SchedulerRunner />
      <MaintenanceRunner />
      <header className="topbar">
        <div><p className="eyebrow">Pico de Vendas</p><h1>Central de operacao</h1><p className="muted">Ola, {access.profile.full_name}</p></div>
        <div className="header-actions"><GroupSelector groups={groups} selected={selectedGroupId} />{["master","admin"].includes(access.profile.role) && <a className="button secondary" href="/admin">Administracao</a>}<form action="/api/auth/logout" method="post"><button className="secondary">Sair</button></form></div>
      </header>
      <nav className="section-nav"><a href="#visao">Visao geral</a><a href="#planejamento">Preparar envio</a><a href="#campanhas">Enviar ou agendar</a><a href="#fila">Fila e log</a><a href="#configuracoes">Configuracoes</a></nav>
      <section className="status-grid" id="visao">
        <article className="status-card"><span>Gateway</span><strong>{health?.gateway_online ? "Online" : "Offline"}</strong></article>
        <article className="status-card"><span>WhatsApp</span><strong>{health?.whatsapp_status ?? "Sem leitura"}</strong></article>
        <article className="status-card"><span>Pendentes</span><strong>{counts.pronto_para_envio ?? 0}</strong></article>
        <article className="status-card"><span>Enviadas hoje</span><strong>{sentToday ?? 0}</strong></article>
        <article className="status-card"><span>Confirmadas hoje</span><strong>{confirmedToday ?? 0}</strong></article>
        <article className="status-card"><span>Agendadas</span><strong>{(campaigns ?? []).filter((item) => item.scheduled_at && new Date(item.scheduled_at).getTime() > Date.now()).length}</strong></article>
        <article className="status-card"><span>Respostas hoje</span><strong>{repliesToday ?? 0}</strong></article>
        <article className="status-card"><span>Reacoes hoje</span><strong>{reactionsToday ?? 0}</strong></article>
      </section>
      <QueueControls />
      {["master","admin"].includes(access.profile.role) && <AccountsManager />}
      {["master","admin"].includes(access.profile.role) && <TestGroupManager />}
      <CampaignPlanner accounts={(accounts ?? []).map(({ id, label }) => ({ id, label }))} groupId={selectedGroupId} />
      <section className="panel" id="campanhas">
        <div className="panel-heading"><div><h2>Campanhas</h2><p>Revise, teste e autorize cada lote.</p></div><a className="button" href="#nova">Nova campanha</a></div>
        <div className="table-wrap"><table><thead><tr><th>Campanha</th><th>Status</th><th>Mensagens</th><th>Criada em</th><th>Acoes</th></tr></thead><tbody>
          {(campaigns ?? []).map((campaign) => <tr key={campaign.id}><td>{campaign.name}{campaign.confirmation_enabled && <><br/><span className="muted">Com confirmacao de leitura</span></>}</td><td><span className={`badge ${campaign.status}`}>{campaignStage(campaign.status, !!campaign.test_sent_at, campaign.scheduled_at)}</span></td><td>{campaign.total_messages}</td><td>{new Date(campaign.created_at).toLocaleString("pt-BR")}</td><td><OperationControls campaignId={campaign.id} status={campaign.status} tested={!!campaign.test_sent_at} totalMessages={campaign.total_messages} />{["rascunho","autorizada","pausada"].includes(campaign.status) && <ScheduleEditor campaignId={campaign.id} scheduledAt={campaign.scheduled_at} />}</td></tr>)}
          {!campaigns?.length && <tr><td colSpan={5} className="empty">Nenhuma campanha criada.</td></tr>}
        </tbody></table></div>
      </section>
      <QueueMonitor campaigns={(campaigns ?? []).map(({ id, name }) => ({ id, name }))} />
      <CommunicationLog groupId={selectedGroupId} />
      <section className="panel" id="nova">
        <div className="panel-heading"><div><h2>Nova campanha</h2><p>Cole uma lista JSON para criar um rascunho. Nenhuma mensagem sera enviada.</p></div></div>
        <form action="/api/campaigns" method="post" encType="multipart/form-data" className="stack">
          <label>Conta de envio<select name="accountId" required>{(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
          <label>Nome<input name="name" required placeholder="Pico de vendas 28/09" /></label>
          <input type="hidden" name="groupId" value={selectedGroupId} />
          <label>Mensagens<textarea name="messages" rows={8} required defaultValue={'[{"gerente_id":"G001","telefone":"5511999999999","mensagem":"Ola, ..."}]'} /></label>
          <label className="check"><input type="checkbox" name="confirmationEnabled" />Incluir link individual de confirmacao de recebimento</label>
          <label>Agendar para, opcional<input type="datetime-local" name="scheduledAt" /></label>
          <label>Anexos, ate 1 PDF e 3 imagens<input type="file" name="attachments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple /></label>
          <label className="check warning"><input type="checkbox" name="riskAccepted" />Confirmo o fracionamento se houver mais de 250 destinatarios.</label>
          <button type="submit">Criar rascunho</button>
        </form>
      </section>
      <SettingsManager canEdit={["master","admin"].includes(access.profile.role)} />
      {["master","admin"].includes(access.profile.role) && <AuditLog />}
    </main>
  );
}
