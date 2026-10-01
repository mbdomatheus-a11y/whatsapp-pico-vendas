"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Session = { id: string; name: string; weekday: string; status: string; source_file_name: string; segmentation_file_name?: string | null; updated_at: string; expires_at?: string | null };

export function PlanningSessionList({ sessions }: { sessions: Session[] }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null);
  async function remove(session: Session) {
    if (!window.confirm(`Excluir a preparacao salva ${session.name}?`)) return;
    setBusy(session.id);
    const response = await fetch(`/api/planning/sessions/${session.id}`, { method: "DELETE" });
    setBusy(null); if (response.ok) router.refresh();
  }
  return <section className="panel"><div className="panel-heading"><div><h2>Preparacoes salvas</h2><p>Retome deste computador ou de outro acesso autorizado do mesmo grupo.</p></div></div>
    <div className="saved-planning-list">{sessions.map((session) => <article className="saved-planning-card" key={session.id}><div><span className="step-kicker">{session.weekday}</span><h3>{session.name}</h3><p className="muted">Picos: {session.source_file_name}<br/>Segmentacao: {session.segmentation_file_name ?? "Nao enviada"}<br/>Atualizada em <time suppressHydrationWarning>{new Date(session.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p></div><div className="actions"><span className={`badge ${session.status === "convertida" ? "concluida" : "processando"}`}>{session.status === "convertida" ? "Campanha criada" : "Previa salva"}</span><a className="button small secondary" href={`/planejamento/${session.id}`}>{session.status === "convertida" ? "Consultar" : "Continuar"}</a><button className="small danger" disabled={busy === session.id} onClick={() => remove(session)}>{busy === session.id ? "Excluindo..." : "Excluir"}</button></div></article>)}{!sessions.length && <p className="empty">Nenhuma preparacao salva.</p>}</div>
  </section>;
}
