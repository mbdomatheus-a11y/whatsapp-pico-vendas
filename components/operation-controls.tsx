"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperationControls({ campaignId, status, tested, totalMessages }: { campaignId: string; status: string; tested: boolean; totalMessages: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function run(action: "test" | "authorize" | "pause") {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? (action === "test" ? `Teste enviado para ${body.sent ?? 1} integrante(s)` : "Atualizado") : body.error ?? "Falha na operacao");
      if (response.ok) router.refresh();
    } catch { setMessage("Falha de conexao. Tente novamente."); }
    finally { setBusy(null); }
  }

  async function startSending() {
    if (totalMessages > 250 && !window.confirm("Campanhas acima de 250 mensagens aumentam o risco de bloqueio. O portal aplicara lotes de ate 100. Deseja continuar?")) return;
    setSending(true); setMessage("Iniciando envios...");
    let totalSent = 0; let totalFailed = 0;
    for (let batch = 0; batch < 500; batch += 1) {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(body.error ?? "Envio interrompido"); break; }
      totalSent += body.sent ?? 0; totalFailed += body.failed ?? 0;
      setMessage(`${totalSent} enviadas, ${body.remaining ?? 0} na fila${totalFailed ? `, ${totalFailed} com erro` : ""}`);
      window.dispatchEvent(new Event("queue-updated"));
      if (body.complete || !body.processed) break;
      if (body.nextDelayMs > 0) { setMessage(`${totalSent} enviadas, ${body.remaining ?? 0} na fila. Proxima em ${Math.ceil(body.nextDelayMs / 1000)}s`); await new Promise((resolve) => window.setTimeout(resolve, body.nextDelayMs)); }
    }
    setSending(false); router.refresh();
  }

  return <div className="actions">
    {status === "rascunho" && !tested && <button className="small secondary" disabled={!!busy || sending} onClick={() => run("test")}>{busy === "test" ? "Enviando teste..." : "1. Enviar teste"}</button>}
    {status === "rascunho" && tested && <button className="small" disabled={!!busy || sending} onClick={() => run("authorize")}>{busy === "authorize" ? "Autorizando..." : "2. Autorizar campanha"}</button>}
    {status === "pausada" && <button className="small" disabled={!!busy || sending} onClick={() => run("authorize")}>{busy === "authorize" ? "Retomando..." : "Retomar e autorizar"}</button>}
    {(status === "autorizada" || status === "processando") && <button className="small whatsapp-action" disabled={sending || !!busy} onClick={startSending}>{sending ? "Enviando..." : status === "autorizada" ? "3. Iniciar envios" : "Continuar envios"}</button>}
    {(status === "autorizada" || status === "processando") && <button className="small danger" disabled={!!busy || sending} onClick={() => run("pause")}>{busy === "pause" ? "Pausando..." : "Pausar campanha"}</button>}
    {message && <span className="action-message">{message}</span>}
  </div>;
}

export function QueueControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function checkHealth() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/health");
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? `Gateway online, WhatsApp: ${body.whatsapp}` : body.detail ?? body.error ?? "Gateway offline");
      router.refresh();
    } catch { setMessage("Nao foi possivel verificar a conexao."); }
    finally { setBusy(false); }
  }
  return <div className="queue-controls">
    <button className="secondary" disabled={busy} onClick={checkHealth}>{busy ? "Verificando conexao..." : "Verificar conexao"}</button>
    {message && <span>{message}</span>}
  </div>;
}
