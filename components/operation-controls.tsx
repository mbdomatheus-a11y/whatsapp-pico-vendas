"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function OperationControls({ campaignId, status, tested, totalMessages, scheduledAt }: { campaignId: string; status: string; tested: boolean; totalMessages: number; scheduledAt?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const stopRequested = useRef(false);
  const scheduledForFuture = !!scheduledAt && new Date(scheduledAt).getTime() > Date.now();

  async function run(action: "test" | "authorize" | "pause" | "stop") {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? (action === "test" ? `Teste enviado para ${body.sent ?? 1} integrante(s)` : action === "pause" ? "Campanha suspensa. Ela retomara do ponto em que parou." : action === "stop" ? "Campanha parada definitivamente. Os itens nao enviados foram cancelados." : "Atualizado") : body.error ?? "Falha na operacao");
      if (response.ok) router.refresh();
    } catch { setMessage("Falha de conexao. Tente novamente."); }
    finally { setBusy(null); }
  }

  async function startSending() {
    if (totalMessages > 250 && !window.confirm("Campanhas acima de 250 mensagens aumentam o risco de bloqueio. O portal aplicara lotes de ate 100. Deseja continuar?")) return;
    stopRequested.current = false; setSending(true); setMessage("Iniciando envios...");
    let totalSent = 0; let totalFailed = 0;
    for (let batch = 0; batch < 500; batch += 1) {
      if (stopRequested.current) break;
      let response: Response | null = null;
      let body: any = {};
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          response = await fetch(`/api/campaigns/${campaignId}/start`, { method: "POST" });
          body = await response.json().catch(() => ({}));
          if (response.ok || response.status < 500) break;
        } catch { response = null; }
        if (attempt < 3) {
          setMessage(`Conexao instavel. Tentativa ${attempt + 1} de 3 em alguns segundos...`);
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
        }
      }
      if (!response?.ok) {
        setMessage(body.error ?? "Os envios foram interrompidos por falha de conexao. A campanha continua em andamento e sera retomada ao reabrir esta tela.");
        break;
      }
      totalSent += body.sent ?? 0; totalFailed += body.failed ?? 0;
      setMessage(`${totalSent} enviadas, ${body.remaining ?? 0} na fila${totalFailed ? `, ${totalFailed} com erro${body.failureReason ? `. Ultimo erro: ${body.failureReason}` : ""}` : ""}`);
      window.dispatchEvent(new Event("queue-updated"));
      if (body.complete || !body.processed) break;
      if (body.nextDelayMs > 0) {
        setMessage(`${totalSent} enviadas, ${body.remaining ?? 0} na fila. Proxima em ${Math.ceil(body.nextDelayMs / 1000)}s`);
        const until = Date.now() + body.nextDelayMs;
        while (!stopRequested.current && Date.now() < until) await new Promise((resolve) => window.setTimeout(resolve, Math.min(250, until - Date.now())));
      }
    }
    setSending(false); router.refresh();
  }

  async function interrupt(action: "pause" | "stop") {
    if (action === "stop" && !window.confirm("Parar definitivamente cancela todos os destinatarios ainda nao enviados e nao permite retomar. Deseja continuar?")) return;
    stopRequested.current = true;
    setBusy(action); setMessage(action === "pause" ? "Suspendendo a campanha... Uma mensagem que ja esteja em envio pode ser concluida." : "Parando a campanha e cancelando os itens restantes...");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? (action === "pause" ? "Campanha suspensa. Use Retomar envio para continuar do ponto em que parou." : `Campanha parada. ${body.cancelled ?? 0} item(ns) restante(s) foram cancelados.`) : body.error ?? "Falha na operacao");
      if (response.ok) { window.dispatchEvent(new Event("queue-updated")); router.refresh(); }
    } catch { setMessage("Falha de conexao. Mantenha o Docker desligado e tente novamente."); }
    finally { setBusy(null); }
  }

  return <div className="actions">
    {status === "rascunho" && !tested && <button className="small secondary" disabled={!!busy || sending} onClick={() => run("test")}>{busy === "test" ? "Enviando teste..." : "1. Enviar teste"}</button>}
    {status === "rascunho" && tested && <button className="small" disabled={!!busy || sending} onClick={() => run("authorize")}>{busy === "authorize" ? "Autorizando..." : "2. Autorizar campanha"}</button>}
    {status === "pausada" && <button className="small" disabled={!!busy || sending} onClick={() => run("authorize")}>{busy === "authorize" ? "Retomando..." : "Retomar envio"}</button>}
    {status === "autorizada" && scheduledForFuture && <span className="action-message">Aguardando o horario programado. Use Editar agendamento se precisar alterar.</span>}
    {((status === "autorizada" && !scheduledForFuture) || status === "processando") && <button className="small whatsapp-action" disabled={sending || !!busy} onClick={startSending}>{sending ? "Enviando ate concluir..." : status === "autorizada" ? "3. Iniciar envios" : "Continuar envios"}</button>}
    {(status === "autorizada" || status === "processando") && <button className="small secondary" disabled={!!busy} onClick={() => interrupt("pause")}>{busy === "pause" ? "Suspendendo..." : "Suspender e retomar depois"}</button>}
    {(["autorizada","processando","pausada"].includes(status)) && <button className="small danger" disabled={!!busy} onClick={() => interrupt("stop")}>{busy === "stop" ? "Parando..." : "Parar definitivamente"}</button>}
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
      setMessage(`${body.title ?? (response.ok ? "Conexao verificada" : "Falha na conexao")}. ${body.action ?? body.detail ?? body.error ?? "Tente novamente."}`);
      router.refresh();
    } catch { setMessage("Nao foi possivel verificar a conexao."); }
    finally { setBusy(false); }
  }
  return <div className="queue-controls">
    <button className="secondary" disabled={busy} onClick={checkHealth}>{busy ? "Verificando conexao..." : "Verificar conexao"}</button>
    {message && <span className="connection-message" role="status">{message}</span>}
  </div>;
}
