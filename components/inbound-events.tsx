"use client";

import { useEffect, useState } from "react";

type InboundItem = { id: string; event_type: "mensagem" | "reacao"; sender_masked: string; content: string; received_at: string; campaigns?: { name?: string } | null };

export function InboundEvents({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<InboundItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const response = await fetch(`/api/inbound-events?groupId=${encodeURIComponent(groupId)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { setItems(body.items ?? []); setError(""); }
      else setError(body.error ?? "Nao foi possivel carregar os retornos");
    } catch { setError("Falha de conexao ao carregar os retornos"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); const update = () => void load(); window.addEventListener("portal-refresh", update); return () => window.removeEventListener("portal-refresh", update); }, [groupId]);
  return <section className="panel" id="retornos-whatsapp">
    <div className="panel-heading"><div><h2>Respostas e reacoes no WhatsApp</h2><p>Retornos recebidos diretamente nas contas conectadas e associados as campanhas.</p></div><button className="small secondary" disabled={busy} onClick={load}>{busy ? "Atualizando..." : "Atualizar"}</button></div>
    {error && <div className="alert error">{error}</div>}
    <div className="table-wrap"><table><thead><tr><th>Campanha</th><th>Gerente</th><th>Tipo</th><th>Retorno</th><th>Recebido em</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.campaigns?.name ?? "-"}</td><td>{item.sender_masked}</td><td><span className={`badge ${item.event_type === "reacao" ? "pronto_para_envio" : "concluida"}`}>{item.event_type === "reacao" ? "Reacao" : "Resposta"}</span></td><td className="message-preview">{item.content}</td><td>{new Date(item.received_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>
    {!items.length && !error && <p className="empty">Nenhuma resposta ou reacao recebida para este grupo.</p>}
  </section>;
}
