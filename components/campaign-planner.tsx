"use client";

import { useState } from "react";
import { WEEKDAYS, type PlannedMessage, type PreviewResult, type Weekday } from "@/lib/planning/types";

const DEFAULT_TEMPLATE = "Ola! O pico de vendas da loja {cod_loja} - {nome_loja} nesta {dia} sera das {faixa_pico}. A escala planejada possui {colaboradores_pico} colaboradores com cobertura nesse periodo. Por favor, organize a equipe para maxima cobertura no pico e confirme o recebimento com OK.";

export function CampaignPlanner() {
  const [day, setDay] = useState<Weekday>("SEGUNDA");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function prepare(formData: FormData) {
    setBusy(true); setError(""); setPreview(null);
    formData.set("day", day); formData.set("template", template);
    const response = await fetch("/api/planning/preview", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error ?? "Falha ao preparar campanha");
    else setPreview(body);
    setBusy(false);
  }

  const queueMessages = preview?.messages.map(({ gerente_id, telefone, mensagem }) => ({ gerente_id, telefone, mensagem })) ?? [];
  return <section className="panel" id="planejamento">
    <div className="panel-heading"><div><h2>Planejar pico de vendas</h2><p>Carregue a planilha, cruze com a escala e revise antes de criar o rascunho.</p></div></div>
    <form action={prepare} className="stack">
      <label>Planilha de picos (.xlsx)<input type="file" name="file" accept=".xlsx" required /></label>
      <label>Dia da semana<select value={day} onChange={(event) => setDay(event.target.value as Weekday)}>{WEEKDAYS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Modelo da mensagem<textarea rows={6} value={template} onChange={(event) => setTemplate(event.target.value)} /></label>
      <p className="token-help">Campos: {'{cod_loja}'}, {'{nome_loja}'}, {'{dia}'}, {'{faixa_pico}'}, {'{colaboradores_pico}'}, {'{regional}'} e {'{ggl}'}.</p>
      <button disabled={busy}>{busy ? "Cruzando dados..." : "Gerar previa segura"}</button>
      {error && <div className="alert error">{error}</div>}
    </form>
    {preview && <div className="preview-block">
      <div className="summary-grid"><strong>{preview.messages.length} mensagens seguras</strong><strong>{preview.matchedStores} escalas encontradas</strong><strong>{preview.warnings.length} alertas</strong></div>
      {preview.warnings.length > 0 && <details><summary>Ver alertas</summary><ul>{preview.warnings.slice(0, 50).map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      <div className="table-wrap"><table><thead><tr><th>Loja</th><th>Faixa</th><th>Equipe no pico</th><th>Mensagem</th></tr></thead><tbody>{preview.messages.slice(0, 30).map((item: PlannedMessage) => <tr key={`${item.gerente_id}-${item.telefone}`}><td>{item.gerente_id} {item.loja}</td><td>{item.faixa_pico}</td><td>{item.colaboradores_no_pico}</td><td className="message-preview">{item.mensagem}</td></tr>)}</tbody></table></div>
      {preview.messages.length > 30 && <p className="muted">Mostrando 30 de {preview.messages.length} mensagens.</p>}
      <form action="/api/campaigns" method="post" className="draft-form">
        <input type="hidden" name="name" value={`Pico ${day}`} />
        <input type="hidden" name="messages" value={JSON.stringify(queueMessages)} />
        <button type="submit" disabled={!queueMessages.length}>Criar campanha em rascunho</button>
        <span>Nenhuma mensagem sera enviada nesta etapa.</span>
      </form>
    </div>}
  </section>;
}
