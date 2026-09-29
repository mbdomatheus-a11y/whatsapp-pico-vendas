"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperationControls({ campaignId, status, tested }: { campaignId: string; status: string; tested: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(action: "test" | "authorize" | "pause") {
    setBusy(action);
    setMessage("");
    const response = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? (action === "test" ? "Teste enviado" : "Atualizado") : body.error ?? "Falha na operacao");
    setBusy(null);
    router.refresh();
  }

  return <div className="actions">
    {status === "rascunho" && <button className="small secondary" disabled={!!busy} onClick={() => run("test")}>Testar</button>}
    {(status === "rascunho" || status === "pausada") && <button className="small" disabled={!!busy || !tested} title={!tested ? "Envie o teste antes" : ""} onClick={() => run("authorize")}>Autorizar</button>}
    {(status === "autorizada" || status === "processando") && <button className="small danger" disabled={!!busy} onClick={() => run("pause")}>Pausar</button>}
    {message && <span className="action-message">{message}</span>}
  </div>;
}

export function QueueControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function processOne() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/queue/process", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? (body.processed ? "Uma mensagem processada" : body.reason) : body.error ?? "Falha no envio");
    setBusy(false);
    router.refresh();
  }
  async function checkHealth() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/health");
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Gateway online, WhatsApp: ${body.whatsapp}` : body.detail ?? body.error ?? "Gateway offline");
    setBusy(false);
    router.refresh();
  }
  return <div className="queue-controls">
    <button className="secondary" disabled={busy} onClick={checkHealth}>Verificar conexao</button>
    <button disabled={busy} onClick={processOne}>Processar proxima</button>
    {message && <span>{message}</span>}
  </div>;
}
