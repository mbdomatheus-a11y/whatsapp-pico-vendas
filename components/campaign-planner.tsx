"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAYS, type Weekday } from "@/lib/planning/types";
import { suggestedCampaignName } from "@/lib/campaigns";
import { GENERAL_MESSAGE_TEMPLATE, SCHEDULE_MESSAGE_TEMPLATE } from "@/lib/planning/templates";

export function CampaignPlanner({ accounts, groupId }: { accounts: { id: string; label: string }[]; groupId: string }) {
  const router = useRouter();
  const [day, setDay] = useState<Weekday>("SEGUNDA");
  const [useSchedule, setUseSchedule] = useState(true);
  const [template, setTemplate] = useState(SCHEDULE_MESSAGE_TEMPLATE);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [name, setName] = useState(() => suggestedCampaignName("SEGUNDA"));
  const [peakName, setPeakName] = useState("");
  const [segmentationName, setSegmentationName] = useState("");

  async function prepare(formData: FormData) {
    setBusy(true); setError("");
    try {
      formData.set("day", day); formData.set("template", template); formData.set("useSchedule", String(useSchedule)); formData.set("accountId", accountId); formData.set("groupId", groupId); formData.set("name", name);
      const response = await fetch("/api/planning/preview", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error ?? "Falha ao importar e salvar a preparacao");
      else router.push(`/planejamento/${body.sessionId}`);
    } catch { setError("Falha de conexao ao preparar a campanha."); }
    finally { setBusy(false); }
  }

  return <>
    <ol className="flow-steps" aria-label="Etapas da preparacao"><li className="active"><span>1</span>Importar dados</li><li><span>2</span>Segmentar</li><li><span>3</span>Revisar previa</li><li><span>4</span>Criar campanha</li></ol>
    <section className="panel import-panel">
      <div className="panel-heading"><div><p className="step-kicker">Etapa 1 de 4</p><h2>Importar e salvar os dados</h2><p>Os arquivos sao processados e somente os dados normalizados ficam salvos por 30 dias, conforme a retencao configurada.</p></div></div>
      <form action={prepare} className="stack">
        <div className="form-grid"><label>Nome da preparacao<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120}/></label><label>Dia da semana<select value={day} onChange={(event) => { const next = event.target.value as Weekday; setDay(next); setName(suggestedCampaignName(next)); }}>{WEEKDAYS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Conta de envio<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label></div>
        <label className="schedule-option"><input type="checkbox" checked={useSchedule} onChange={(event) => { const enabled = event.target.checked; setUseSchedule(enabled); setTemplate((current) => current === (enabled ? GENERAL_MESSAGE_TEMPLATE : SCHEDULE_MESSAGE_TEMPLATE) ? (enabled ? SCHEDULE_MESSAGE_TEMPLATE : GENERAL_MESSAGE_TEMPLATE) : current); }}/><span><strong>Cruzar com a escala de colaboradores</strong><small>{useSchedule ? "Ativado: o portal consultara a API e calculara a equipe no pico." : "Desativado: a planilha sera usada apenas para destinatarios e segmentacao."}</small></span></label>
        <div className="import-grid">
          <label className={`upload-card ${peakName ? "complete" : ""}`}><span className="upload-step">Obrigatorio</span><strong>Planilha de picos</strong><small>Formato .xlsx, ate 8 MB</small><input type="file" name="file" accept=".xlsx" required onChange={(event) => setPeakName(event.target.files?.[0]?.name ?? "")}/><em>{peakName || "Selecione o arquivo principal"}</em></label>
          <label className={`upload-card ${segmentationName ? "complete" : ""}`}><span className="upload-step">Opcional</span><strong>Planilha de segmentacao</strong><small>Primeira coluna COD ou COD_LOJA</small><input type="file" name="segmentationFile" accept=".xlsx" onChange={(event) => setSegmentationName(event.target.files?.[0]?.name ?? "")}/><em>{segmentationName || "Adicione regional, estado e outros recortes"}</em></label>
        </div>
        <details className="template-editor" open><summary>Texto da mensagem</summary><label>Modelo<textarea rows={6} value={template} onChange={(event) => setTemplate(event.target.value)} required maxLength={3000}/></label><div className="template-actions"><button type="button" className="small secondary" disabled={busy || !template} onClick={() => setTemplate("")}>Limpar texto</button><button type="button" className="small secondary" disabled={busy || template === (useSchedule ? SCHEDULE_MESSAGE_TEMPLATE : GENERAL_MESSAGE_TEMPLATE)} onClick={() => setTemplate(useSchedule ? SCHEDULE_MESSAGE_TEMPLATE : GENERAL_MESSAGE_TEMPLATE)}>Restaurar texto original</button></div><p className="token-help">Campos: {'{cod_loja}'}, {'{nome_loja}'}, {'{dia}'}, {'{faixa_pico}'}, {'{colaboradores_pico}'}, {'{regional}'} e {'{ggl}'}. O texto digitado sera respeitado em todas as mensagens.</p></details>
        <div className="flow-action"><div><strong>O que acontece agora?</strong><p>{useSchedule ? "O portal cruza as escalas, salva a preparacao e abre a segmentacao." : "O portal nao consultara a escala. Ele salva a preparacao e abre a segmentacao."} Nenhuma mensagem sera enviada.</p></div><button disabled={busy || !accountId || !template.trim()}>{busy ? (useSchedule ? "Importando, cruzando e salvando..." : "Importando e salvando...") : "Gerar previa e continuar"}</button></div>
        {error && <div className="alert error">{error}</div>}
      </form>
    </section>
  </>;
}
