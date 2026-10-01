import { PortalShell } from "@/components/portal-shell";
import { QueueControls } from "@/components/operation-controls";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { formatBrazilianPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const params = await searchParams;
  const viewAllGroups = access.profile.role === "master" && params.grupo === "todos";
  const admin = createAdminClient(); const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const groupIds = groups.map((group) => group.id);
  const scopedAdmin = admin as any;
  const scope = (query: any, column: string) => viewAllGroups ? query.in(column, groupIds) : query.eq(column, selectedGroupId);
  const [{ data: campaigns }, { data: queue }, { data: health }, { data: accountRows }, { count: confirmedToday }, { count: sentToday }, { count: repliesToday }, { count: reactionsToday }] = await Promise.all([
    scope(scopedAdmin.from("campaigns").select("id,scheduled_at").is("archived_at", null), "group_id"),
    scope(scopedAdmin.from("message_queue").select("status,campaigns!inner(group_id,archived_at)").is("campaigns.archived_at", null), "campaigns.group_id"),
    supabase.from("gateway_health").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("whatsapp_accounts").select("id,label,phone_number,instance_name").eq("organization_id", access.profile.organization_id).eq("enabled", true).order("created_at"),
    scope(scopedAdmin.from("read_confirmations").select("id,campaigns!inner(group_id)", { count: "exact", head: true }).gte("confirmed_at", startOfDay.toISOString()), "campaigns.group_id"),
    scope(scopedAdmin.from("communication_logs").select("id", { count: "exact", head: true }).gte("sent_at", startOfDay.toISOString()), "group_id"),
    scope(scopedAdmin.from("inbound_events").select("id", { count: "exact", head: true }).eq("event_type", "mensagem").gte("received_at", startOfDay.toISOString()), "group_id"),
    scope(scopedAdmin.from("inbound_events").select("id", { count: "exact", head: true }).eq("event_type", "reacao").gte("received_at", startOfDay.toISOString()), "group_id"),
  ]);
  const queueItems = (queue ?? []) as Array<{ status: string }>;
  const campaignItems = (campaigns ?? []) as Array<{ scheduled_at?: string | null }>;
  const counts = queueItems.reduce((acc: Record<string, number>, item: { status: string }) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});
  const whatsappStatus = health?.whatsapp_status === "open" ? "Conectado" : health?.whatsapp_status === "connecting" ? "Conectando" : health?.gateway_online ? "Desconectado" : "Indisponivel";
  const accounts = await Promise.all((accountRows ?? []).map(async (account) => ({ ...account, health: await new EvolutionProvider(account.instance_name).health() })));
  return <PortalShell active="visao" title="Visao geral" description={viewAllGroups ? "Resumo de todos os grupos" : "Resumo do dia"} fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId} viewAllGroups={viewAllGroups}>
    <section className="status-grid">
      <article className="status-card"><span>Gateway</span><strong>{health?.gateway_online ? "Online" : "Offline"}</strong></article>
      <article className={`status-card ${health?.whatsapp_status === "open" ? "whatsapp-highlight" : "status-warning"}`}><span>WhatsApp</span><strong>{whatsappStatus}</strong></article>
      <article className="status-card"><span>Pendentes</span><strong>{counts.pronto_para_envio ?? 0}</strong></article>
      <article className="status-card"><span>Enviadas hoje</span><strong>{sentToday ?? 0}</strong></article>
      <article className="status-card"><span>Confirmadas hoje</span><strong>{confirmedToday ?? 0}</strong></article>
      <article className="status-card"><span>Agendadas</span><strong>{campaignItems.filter((item) => item.scheduled_at && new Date(item.scheduled_at).getTime() > Date.now()).length}</strong></article>
      <article className="status-card"><span>Respostas hoje</span><strong>{repliesToday ?? 0}</strong></article>
      <article className="status-card"><span>Reacoes hoje</span><strong>{reactionsToday ?? 0}</strong></article>
    </section>
    <section className="panel account-health-panel"><div className="panel-heading"><div><h2>Numeros conectados</h2><p>Situacao individual de cada conta disponivel para campanhas.</p></div><a className="button secondary small" href="/configuracoes#contas">Gerenciar contas</a></div><div className="account-health-grid">{accounts.map((account) => <article className="account-health-item" key={account.id}><div><strong>{account.label}</strong><span>{formatBrazilianPhone(account.phone_number)}</span></div><span className={`badge ${account.health.code === "connected" ? "concluida" : "pausada"}`}>{account.health.title}</span></article>)}</div>{!accounts.length && <p className="empty">Nenhuma conta ativa cadastrada.</p>}</section>
    <QueueControls />
    <section className="quick-grid"><a className="quick-card" href="/planejamento"><strong>Preparar novo envio</strong><span>Importar planilhas e revisar a previa</span></a><a className="quick-card" href="/campanhas"><strong>Acompanhar campanhas</strong><span>Testar, autorizar, agendar ou iniciar</span></a><a className="quick-card" href="/fila"><strong>Ver fila e historico</strong><span>Consultar andamento e confirmacoes</span></a></section>
  </PortalShell>;
}
