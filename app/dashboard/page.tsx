import { PortalShell } from "@/components/portal-shell";
import { QueueControls } from "@/components/operation-controls";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const { supabase, access, groups, selectedGroupId } = await getPortalContext();
  const admin = createAdminClient(); const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const [{ data: campaigns }, { data: queue }, { data: health }, { count: confirmedToday }, { count: sentToday }, { count: repliesToday }, { count: reactionsToday }] = await Promise.all([
    supabase.from("campaigns").select("id,scheduled_at").eq("group_id", selectedGroupId).is("archived_at", null),
    supabase.from("message_queue").select("status,campaigns!inner(group_id,archived_at)").eq("campaigns.group_id", selectedGroupId).is("campaigns.archived_at", null),
    supabase.from("gateway_health").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("read_confirmations").select("id,campaigns!inner(group_id)", { count: "exact", head: true }).eq("campaigns.group_id", selectedGroupId).gte("confirmed_at", startOfDay.toISOString()),
    admin.from("communication_logs").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).gte("sent_at", startOfDay.toISOString()),
    admin.from("inbound_events").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).eq("event_type", "mensagem").gte("received_at", startOfDay.toISOString()),
    admin.from("inbound_events").select("id", { count: "exact", head: true }).eq("group_id", selectedGroupId).eq("event_type", "reacao").gte("received_at", startOfDay.toISOString()),
  ]);
  const counts = (queue ?? []).reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {});
  return <PortalShell active="visao" title="Visao geral" description="Resumo do dia" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}>
    <section className="status-grid">
      <article className="status-card"><span>Gateway</span><strong>{health?.gateway_online ? "Online" : "Offline"}</strong></article>
      <article className="status-card whatsapp-highlight"><span>WhatsApp</span><strong>{health?.whatsapp_status ?? "Sem leitura"}</strong></article>
      <article className="status-card"><span>Pendentes</span><strong>{counts.pronto_para_envio ?? 0}</strong></article>
      <article className="status-card"><span>Enviadas hoje</span><strong>{sentToday ?? 0}</strong></article>
      <article className="status-card"><span>Confirmadas hoje</span><strong>{confirmedToday ?? 0}</strong></article>
      <article className="status-card"><span>Agendadas</span><strong>{(campaigns ?? []).filter((item) => item.scheduled_at && new Date(item.scheduled_at).getTime() > Date.now()).length}</strong></article>
      <article className="status-card"><span>Respostas hoje</span><strong>{repliesToday ?? 0}</strong></article>
      <article className="status-card"><span>Reacoes hoje</span><strong>{reactionsToday ?? 0}</strong></article>
    </section>
    <QueueControls />
    <section className="quick-grid"><a className="quick-card" href="/planejamento"><strong>Preparar novo envio</strong><span>Importar planilhas e revisar a previa</span></a><a className="quick-card" href="/campanhas"><strong>Acompanhar campanhas</strong><span>Testar, autorizar, agendar ou iniciar</span></a><a className="quick-card" href="/fila"><strong>Ver fila e historico</strong><span>Consultar andamento e confirmacoes</span></a></section>
  </PortalShell>;
}
