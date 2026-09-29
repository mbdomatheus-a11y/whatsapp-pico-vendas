"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Message = { gerente_id: string; telefone: string; mensagem: string };
type Account = { id: string; label: string };

function brasiliaInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string,string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function CampaignDraftForm({
  defaultName, groupId, messages, accountId, accounts, planningSessionId, editableMessages = false,
}: {
  defaultName: string;
  groupId: string;
  messages: Message[];
  accountId?: string;
  accounts?: Account[];
  planningSessionId?: string;
  editableMessages?: boolean;
}) {
  const router = useRouter();
  const [scheduleMode, setScheduleMode] = useState<"immediate"|"scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [messageJson, setMessageJson] = useState(JSON.stringify(messages, null, editableMessages ? 2 : 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const minimumSchedule = useMemo(() => brasiliaInputValue(new Date(Date.now() + 5 * 60_000)), []);
  const messageCount = useMemo(() => {
    try { const parsed = JSON.parse(messageJson); return Array.isArray(parsed) ? parsed.length : 0; }
    catch { return 0; }
  }, [messageJson]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (scheduleMode === "scheduled" && (!scheduledAt || scheduledAt < minimumSchedule)) {
      setError("Escolha um horario de Brasilia com pelo menos 5 minutos de antecedencia."); return;
    }
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      form.set("scheduleMode", scheduleMode);
      form.set("messages", messageJson);
      if (scheduleMode === "immediate") form.delete("scheduledAt");
      const response = await fetch("/api/campaigns", { method: "POST", body: form, headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error ?? "Nao foi possivel criar a campanha.");
      else { router.push(body.redirectTo ?? "/campanhas"); router.refresh(); }
    } catch { setError("Falha de conexao ao criar a campanha."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} encType="multipart/form-data" className="stack">
    {accounts ? <label>Conta de envio<select name="accountId" required defaultValue={accounts[0]?.id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label> : <input type="hidden" name="accountId" value={accountId}/>} 
    <label>Nome da campanha<input name="name" defaultValue={defaultName} required maxLength={120}/></label>
    <input type="hidden" name="groupId" value={groupId}/>{planningSessionId && <input type="hidden" name="planningSessionId" value={planningSessionId}/>} 
    {editableMessages ? <label>Mensagens<textarea rows={8} required value={messageJson} onChange={(event) => setMessageJson(event.target.value)}/></label> : <input type="hidden" name="messages" value={messageJson}/>} 
    <label className="check"><input type="checkbox" name="confirmationEnabled"/>Incluir link individual de confirmacao de recebimento</label>
    <fieldset className="schedule-choice"><legend>Quando iniciar apos teste e autorizacao?</legend>
      <label className="check"><input type="radio" name="scheduleChoice" value="immediate" checked={scheduleMode === "immediate"} onChange={() => setScheduleMode("immediate")}/><span><strong>Assim que eu iniciar os envios</strong><small>O rascunho nao envia nada sozinho.</small></span></label>
      <label className="check"><input type="radio" name="scheduleChoice" value="scheduled" checked={scheduleMode === "scheduled"} onChange={() => setScheduleMode("scheduled")}/><span><strong>Agendar data e horario</strong><small>Use o horario de Brasilia e escolha pelo menos 5 minutos a frente.</small></span></label>
      {scheduleMode === "scheduled" && <label>Data e horario de Brasilia<input type="datetime-local" name="scheduledAt" value={scheduledAt} min={minimumSchedule} required onChange={(event) => setScheduledAt(event.target.value)}/></label>}
    </fieldset>
    <label>Anexos, ate 1 PDF e 3 imagens<input type="file" name="attachments" accept="application/pdf,image/jpeg,image/png,image/webp" multiple/></label>
    {messageCount > 250 && <label className="check warning"><input type="checkbox" name="riskAccepted" required/>Estou ciente do risco e aceito o fracionamento em lotes de ate 100.</label>}
    {error && <div className="alert error" role="alert">{error}</div>}
    <button type="submit" disabled={busy || !messageCount}>{busy ? "Criando campanha..." : "Avancar e criar rascunho"}</button>
  </form>;
}
