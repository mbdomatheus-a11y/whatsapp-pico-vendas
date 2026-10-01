"use client";
import { useMemo, useState } from "react";
import type { PreviewResult } from "@/lib/planning/types";
import { CampaignDraftForm } from "@/components/campaign-draft-form";

type SavedSession = { id: string; name: string; weekday: string; status: string; group_id: string; whatsapp_account_id: string; source_file_name: string; segmentation_file_name?: string | null; selected_filters: Record<string,string>; preview_payload: PreviewResult; use_schedule?: boolean; expires_at?: string | null; campaign_id?: string | null; accountLabel?: string };

export function PlanningSessionView({ session, accounts }: { session: SavedSession; accounts: { id: string; label: string }[] }) {
  const [filters, setFilters] = useState<Record<string,string>>(session.selected_filters ?? {});
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const useSchedule = session.use_schedule ?? session.preview_payload.useSchedule ?? true;
  const filtered = useMemo(() => session.preview_payload.messages.filter((item) => Object.entries(filters).every(([key,value]) => !value || item.segmentos?.[key] === value)), [filters, session.preview_payload.messages]);
  const hasActiveFilter = Object.values(filters).some(Boolean);
  const queueMessages = useMemo(() => filtered.map(({ gerente_id, telefone, mensagem }) => ({ gerente_id, telefone, mensagem })), [filtered]);
  async function saveFilters() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/planning/sessions/${session.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ filters }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? "Selecao salva. Voce pode continuar depois de qualquer computador." : body.error ?? "Falha ao salvar selecao"); setBusy(false);
  }
  return <>
    <ol className="flow-steps" aria-label="Etapas da preparacao"><li className="done"><span>1</span>Dados importados</li><li className="active"><span>2</span>Segmentacao</li><li className="active"><span>3</span>Previa salva</li><li><span>4</span>Criar campanha</li></ol>
    <section className="panel planning-summary"><div className="panel-heading"><div><p className="step-kicker">Preparacao salva</p><h2>{session.name}</h2><p>Picos: {session.source_file_name} · Segmentacao: {session.segmentation_file_name ?? "Nao enviada"}</p></div><span className={`badge ${session.status === "convertida" ? "concluida" : "processando"}`}>{session.status === "convertida" ? "Campanha criada" : "Pronta para continuar"}</span></div>
      <div className="summary-grid"><strong>{filtered.length} destinatarios selecionados</strong><strong>{useSchedule ? `${session.preview_payload.matchedStores} lojas com escala` : "Cruzamento com escala desativado"}</strong><strong>{session.preview_payload.warnings.length} alertas de dados</strong></div>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Segmentacao da campanha</h2><p>Escolha os recortes. Cada selecao atualiza a quantidade antes da criacao da campanha.</p></div></div>
      {Object.keys(session.preview_payload.facets ?? {}).length ? <div className="segmentation-grid">{Object.entries(session.preview_payload.facets).map(([key,values]) => <article className="segment-card" key={key}><label>{key.replaceAll("_"," ")}<select value={filters[key] ?? ""} onChange={(event) => setFilters((current) => ({...current,[key]:event.target.value}))}><option value="">Todos ({values.length} opcoes)</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{filters[key] && <button className="small secondary" onClick={() => setFilters((current) => ({...current,[key]:""}))}>Limpar filtro</button>}</article>)}</div> : <div className="alert warning">A planilha nao trouxe colunas adicionais de segmentacao. A campanha usara todas as lojas validas.</div>}
      <div className="selection-bar"><strong>{filtered.length} mensagens nesta selecao</strong><button disabled={busy} onClick={saveFilters}>{busy ? "Salvando selecao..." : "Salvar selecao"}</button></div>{message && <p className="action-message">{message}</p>}
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Previa das mensagens</h2><p>Confira uma amostra antes de avancar. Telefones continuam ocultos.</p></div></div>
      {session.preview_payload.warnings.length > 0 && <details><summary>Ver alertas da importacao</summary><ul>{session.preview_payload.warnings.slice(0,50).map((warning,index) => <li key={index}>{warning}</li>)}</ul></details>}
      <div className="table-wrap"><table><thead><tr><th>Destinatario</th><th>Faixa</th>{useSchedule && <th>Equipe</th>}<th>Mensagem</th></tr></thead><tbody>{filtered.slice(0,30).map((item) => <tr key={`${item.gerente_id}-${item.telefone}`}><td>{item.gerente_id}<br/><span className="muted">{item.loja}</span></td><td>{item.faixa_pico}</td>{useSchedule && <td>{item.colaboradores_no_pico ?? "Sem escala"}</td>}<td className="message-preview">{item.mensagem}</td></tr>)}</tbody></table></div>{filtered.length > 30 && <p className="muted">Mostrando 30 de {filtered.length} mensagens.</p>}
    </section>
    {session.status === "convertida" ? <section className="panel"><div className="confirmation-result">Esta preparacao ja foi convertida em campanha.</div>{session.campaign_id && <a className="button secondary" href="/campanhas">Abrir campanhas</a>}</section> : <section className="panel next-step-panel"><div><p className="step-kicker">Etapa 4</p><h2>Criar campanha em rascunho</h2><p className="muted">O servidor reconstruira a fila usando somente os filtros exibidos acima. Nada sera enviado antes do teste, autorizacao e inicio manual.</p></div><CampaignDraftForm defaultName={session.name} groupId={session.group_id} accountId={session.whatsapp_account_id} accounts={accounts} planningSessionId={session.id} messages={queueMessages} selectedFilters={filters} requireAllRecipientsConfirmation={!!session.segmentation_file_name && !hasActiveFilter}/></section>}
  </>;
}
