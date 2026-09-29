"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Recipient = { id: string; label: string; maskedPhone: string; active: boolean };

export function TestGroupManager() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/test-group", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setRecipients(body.recipients ?? []);
    else setMessage(body.error ?? "Nao foi possivel carregar o grupo de teste");
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/test-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: data.get("label"), phone: data.get("phone") }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Integrante adicionado ao grupo" : body.error ?? "Falha ao adicionar integrante");
    if (response.ok) { form.reset(); await load(); }
    setBusy(false);
  }

  async function remove(recipient: Recipient) {
    if (!window.confirm(`Remover ${recipient.label} do grupo de teste?`)) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/test-group/${recipient.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Integrante removido" : body.error ?? "Falha ao remover integrante");
    if (response.ok) await load();
    setBusy(false);
  }

  return <section className="panel" id="grupo-teste">
    <div className="panel-heading"><div><h2>Grupo fixo de teste</h2><p>Todo teste de campanha sera enviado para todos os integrantes ativos. Os numeros ficam protegidos e aparecem mascarados.</p></div><button className="secondary small" disabled={busy} onClick={load}>Atualizar</button></div>
    <div className="account-grid">{recipients.map((recipient) => <article className="account-card" key={recipient.id}><strong>{recipient.label}</strong><span>{recipient.maskedPhone}</span><span className="badge concluida">Ativo</span><button className="small danger" disabled={busy} onClick={() => remove(recipient)}>Remover</button></article>)}</div>
    {!recipients.length && <p className="muted">Nenhum integrante cadastrado.</p>}
    <form className="test-group-form" onSubmit={add}>
      <label>Nome<input name="label" required maxLength={80} placeholder="Ex.: Matheus" /></label>
      <label>Celular com DDD<input name="phone" required inputMode="tel" placeholder="Ex.: 5511999999999" /></label>
      <button disabled={busy}>{busy ? "Salvando..." : "Adicionar ao grupo"}</button>
    </form>
    {message && <p className="action-message">{message}</p>}
  </section>;
}
