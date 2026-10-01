"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  id: string;
  label: string;
  instance_name: string;
  health?: { gateway: boolean; whatsapp: string; title: string; detail: string; action: string; code: string };
  webhook?: { enabled: boolean; reachable: boolean };
};

export function AccountsManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [qrAccountLabel, setQrAccountLabel] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function load(showProgress = false) {
    if (showProgress) setBusyAction("load");
    try {
      const response = await fetch("/api/accounts"); const body = await response.json().catch(() => ({}));
      if (response.ok) setAccounts(body.accounts ?? []); else setMessage(body.error ?? "Falha ao consultar contas");
    } finally { if (showProgress) setBusyAction(null); }
  }
  useEffect(() => { void load(false); }, []);

  async function create(formData: FormData) {
    setBusyAction("create"); setMessage(""); setQr(null); setQrAccountLabel("");
    const label = String(formData.get("label") ?? "");
    try {
      const response = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, instanceName: formData.get("instanceName") }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(body.error ?? "Falha ao criar conta"); return; }
      if (body.qr) {
        setQr(String(body.qr).startsWith("data:") ? body.qr : `data:image/png;base64,${body.qr}`);
        setQrAccountLabel(body.account?.label ?? label);
        setMessage("Nova conta criada. Leia o QR Code somente com o WhatsApp que deseja vincular a ela.");
      } else setMessage(body.warning ? `Conta criada. ${body.warning}. Use o botao Conectar / QR desta nova conta.` : "Conta criada. Use o botao Conectar / QR desta nova conta.");
      await load(false); router.refresh();
    } catch { setMessage("Nao foi possivel criar a nova conta. Confirme se o Docker e o tunel Cloudflare estao ativos."); }
    finally { setBusyAction(null); }
  }
  async function connect(account: Account) {
    setBusyAction(`connect:${account.id}`); setMessage(""); setQr(null); setQrAccountLabel("");
    try {
      const response = await fetch(`/api/accounts/${account.id}/connect`, { method: "POST" }); const body = await response.json().catch(() => ({}));
      if (response.ok && body.qr) { setQr(String(body.qr).startsWith("data:") ? body.qr : `data:image/png;base64,${body.qr}`); setQrAccountLabel(account.label); setMessage(body.recreated ? `A instancia de ${account.label} foi recriada. Leia o novo QR Code.` : `QR Code gerado para ${account.label}.`); }
      else setMessage(response.ok ? `Codigo de pareamento de ${account.label}: ${body.pairingCode ?? "indisponivel"}` : body.error ?? "Falha ao gerar QR Code");
    } catch { setMessage(`Nao foi possivel conectar ${account.label}. Confirme o Docker e o tunel Cloudflare.`); }
    finally { setBusyAction(null); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remover esta conexao do portal e do gateway?")) return;
    setBusyAction(`remove:${id}`); const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" }); const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Conta removida" : body.error ?? "Falha ao remover conta"); if (response.ok) { await load(false); router.refresh(); } setBusyAction(null);
  }
  async function enableInbound(id: string) {
    setBusyAction(`webhook:${id}`); setMessage("");
    try {
      const response = await fetch(`/api/accounts/${id}/webhook`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? body.message ?? "Coleta ativada" : body.error ?? "Nao foi possivel ativar a coleta");
      if (response.ok) await load(false);
    } catch { setMessage("Nao foi possivel falar com a estacao local. Confirme se o Docker e o tunel Cloudflare estao ativos."); }
    finally { setBusyAction(null); }
  }
  return <section className="panel" id="contas">
    <div className="panel-heading"><div><h2>Contas do WhatsApp</h2><p>Conecte e acompanhe ate 10 numeros. Em cada campanha, use um numero ou alterne entre varios.</p></div><button type="button" className="secondary small" disabled={busyAction === "load"} onClick={() => load(true)}>{busyAction === "load" ? "Atualizando..." : "Atualizar"}</button></div>
    <div className="account-grid">{accounts.map((account) => <article className="account-card" key={account.id}>
      <strong>{account.label}</strong><span>{account.instance_name}</span>
      <span className={`badge ${account.health?.code === "connected" ? "concluida" : "pausada"}`}>{account.health?.title ?? "Verificando conexao"}</span>
      {account.health && <div className="connection-help"><strong>{account.health.detail}</strong><span>{account.health.action}</span></div>}
      <span className={`badge ${account.webhook?.enabled ? "concluida" : "pronto_para_envio"}`}>{account.webhook?.enabled ? "Respostas e reacoes ativas" : "Coleta de respostas inativa"}</span>
      <div className="actions"><button type="button" className="small whatsapp-action" disabled={busyAction === `connect:${account.id}`} onClick={() => connect(account)}>{busyAction === `connect:${account.id}` ? "Gerando QR..." : "Conectar / QR"}</button><button type="button" className="small secondary" disabled={busyAction === `webhook:${account.id}` || !account.health?.gateway} onClick={() => enableInbound(account.id)}>{busyAction === `webhook:${account.id}` ? "Configurando..." : account.webhook?.enabled ? "Reconfigurar respostas" : "Ativar respostas"}</button>{accounts.length > 1 && <button type="button" className="small danger" disabled={busyAction === `remove:${account.id}`} onClick={() => remove(account.id)}>{busyAction === `remove:${account.id}` ? "Removendo..." : "Remover"}</button>}</div>
    </article>)}</div>
    {accounts.length < 10 && <form action={create} className="stack compact-form"><label>Nome da nova conta<input name="label" required placeholder={`Ex.: Numero ${accounts.length + 1}`} /></label><label>Novo identificador tecnico<input name="instanceName" required pattern="[a-zA-Z0-9_-]{2,60}" placeholder={`numero-${accounts.length + 1}`} /></label><button type="submit" disabled={busyAction === "create"}>{busyAction === "create" ? "Criando nova instancia..." : `Adicionar novo numero (${accounts.length}/10)`}</button></form>}
    {qr && <div className="qr-modal"><p><strong>QR Code da conta: {qrAccountLabel}</strong></p><p>Abra o WhatsApp que sera usado nesta conta e leia o codigo:</p><img src={qr} alt={`QR Code para conectar ${qrAccountLabel}`} /></div>}
    {message && <div className="alert">{message}</div>}
  </section>;
}
