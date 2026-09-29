"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ScheduleEditor({ campaignId, scheduledAt }: { campaignId: string; scheduledAt?: string | null }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [value, setValue] = useState(scheduledAt ? new Date(new Date(scheduledAt).getTime() - 3 * 3600000).toISOString().slice(0,16) : ""); const [message, setMessage] = useState("");
  async function save() { const response = await fetch(`/api/campaigns/${campaignId}/schedule`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt: value }) }); const body = await response.json().catch(() => ({})); setMessage(response.ok ? "Agendamento atualizado" : body.error ?? "Falha ao atualizar"); if (response.ok) { setEditing(false); router.refresh(); } }
  return <div className="schedule-editor">{!editing ? <button className="small secondary" onClick={() => setEditing(true)}>{scheduledAt ? "Editar agendamento" : "Programar"}</button> : <div className="actions"><input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} /><button className="small" onClick={save}>Salvar</button><button className="small secondary" onClick={() => setEditing(false)}>Cancelar</button></div>}{message && <span className="action-message">{message}</span>}</div>;
}
