"use client";

import { useCallback, useEffect, useState } from "react";

type Campaign = { id: string; name: string };
type QueueItem = { id: string; campaign_id: string; gerente_id: string; status: string; tentativas: number; destination_masked?: string | null; erro?: string | null; enviado_em?: string | null; created_at: string; campaigns?: { name?: string } | null };

const STATUS: Record<string, string> = { pendente: "Aguardando autorização", pronto_para_envio: "Pronta para envio", processando: "Enviando agora", enviado: "Enviada com sucesso", erro: "Erro no envio" };

export function QueueMonitor({ campaigns }: { campaigns: Campaign[] }) {
  const [campaignId, setCampaignId] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
    const response = await fetch(`/api/queue${query}`, { cache: "no-store" }); const body = await response.json().catch(() => ({}));
    if (response.ok) { setItems(body.items ?? []); setTotals(body.totals ?? {}); setError(""); } else setError(body.error ?? "Falha ao consultar a fila");
  }, [campaignId]);
  useEffect(() => { void load(); const timer = window.setInterval(load, 4000); const update = () => void load(); window.addEventListener("queue-updated", update); return () => { window.clearInterval(timer); window.removeEventListener("queue-updated", update); }; }, [load]);

  return <section className="panel" id="fila">
    <div className="panel-heading"><div><h2>Fila de envios</h2><p>Acompanhe cada destinatario sem exibir o numero completo ou o texto enviado.</p></div><button className="small secondary" onClick={load}>Atualizar agora</button></div>
    <label className="queue-filter">Filtrar por campanha<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">Todas as campanhas</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
    <div className="summary-grid"><strong>{totals.pendente ?? 0} aguardando autorização</strong><strong>{totals.pronto_para_envio ?? 0} prontas</strong><strong>{totals.processando ?? 0} em andamento</strong><strong>{totals.enviado ?? 0} enviadas</strong><strong>{totals.erro ?? 0} com erro</strong></div>
    {error && <div className="alert error">{error}</div>}
    <div className="table-wrap"><table><thead><tr><th>Campanha</th><th>Destinatário</th><th>Telefone</th><th>Etapa</th><th>Tentativas</th><th>Conclusão</th><th>Detalhe</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.campaigns?.name ?? item.campaign_id}</td><td>{item.gerente_id}</td><td>{item.destination_masked ?? "Protegido"}</td><td><span className={`badge ${item.status}`}>{STATUS[item.status] ?? item.status}</span></td><td>{item.tentativas}</td><td>{item.enviado_em ? new Date(item.enviado_em).toLocaleString("pt-BR") : "-"}</td><td>{item.erro ?? "-"}</td></tr>)}</tbody></table></div>
    {!items.length && !error && <p className="empty">Nenhum item encontrado para este filtro.</p>}
  </section>;
}
