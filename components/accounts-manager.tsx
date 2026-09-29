"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; label: string; instance_name: string; health?: { gateway: boolean; whatsapp: string } };

export function AccountsManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/accounts"); const body = await response.json().catch(() => ({}));
    if (response.ok) setAccounts(body.accounts ?? []); else setMessage(body.error ?? "Falha ao consultar contas");
  }
  useEffect(() => { void load(); }, []);

  async function create(formData: FormData) {
    setBusy(true); setMessage(""); setQr(null);
    const response = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: formData.get("label"), instanceName: formData.get("instanceName") }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? "Conta criada. Agora conecte pelo QR Code." : body.error ?? "Falha ao criar conta");
    if (response.ok) { await load(); router.refresh(); } setBusy(false);
  }
  async function connect(id: string) {
    setBusy(true); setMessage(""); setQr(null);
    const response = await fetch(`/api/accounts/${id}/connect`, { method: "POST" }); const body = await response.json().catch(() => ({}));
    if (response.ok && body.qr) setQr(String(body.qr).startsWith("data:") ? body.qr : `data:image/png;base64,${body.qr}`);
    else setMessage(response.ok ? `Codigo de pareamento: ${body.pairingCode ?? "indisponivel"}` : body.error ?? "Falha ao gerar QR Code");
    setBusy(false);
  }
  async function remove(id: string) {
    if (!window.confirm("Remover esta conexao do portal e do gateway?")) return;
    setBusy(true); const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" }); const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Conta removida" : body.error ?? "Falha ao remover conta"); if (response.ok) { await load(); router.refresh(); } setBusy(false);
  }
  return <section className="panel" id="contas">
    <div className="panel-heading"><div><h2>Contas do WhatsApp</h2><p>Conecte e acompanhe ate dois numeros. A conta e escolhida ao criar cada campanha.</p></div><button className="secondary small" disabled={busy} onClick={load}>Atualizar</button></div>
    <div className="account-grid">{accounts.map((account) => <article className="account-card" key={account.id}><strong>{account.label}</strong><span>{account.instance_name}</span><span className={`badge ${account.health?.whatsapp === "open" ? "concluida" : "pausada"}`}>{account.health?.whatsapp ?? "verificando"}</span><div className="actions"><button className="small whatsapp-action" disabled={busy} onClick={() => connect(account.id)}>{busy ? "Processando..." : "Conectar / QR"}</button>{accounts.length > 1 && <button className="small danger" disabled={busy} onClick={() => remove(account.id)}>Remover</button>}</div></article>)}</div>
    {accounts.length < 2 && <form action={create} className="stack compact-form"><label>Nome da conta<input name="label" required placeholder="Ex.: Numero 2" /></label><label>Identificador tecnico<input name="instanceName" required pattern="[a-zA-Z0-9_-]{2,60}" placeholder="numero-2" /></label><button disabled={busy}>Criar segunda conta</button></form>}
    {qr && <div className="qr-modal"><p>Abra o WhatsApp deste numero e leia o QR Code:</p><img src={qr} alt="QR Code para conectar WhatsApp" /></div>}
    {message && <div className="alert">{message}</div>}
  </section>;
}
