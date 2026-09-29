"use client";
import { useEffect, useState } from "react";
export function ReadConfirmation({ token }: { token: string }) {
  const [status, setStatus] = useState("Registrando sua confirmacao...");
  useEffect(() => { void fetch(`/api/confirm/${encodeURIComponent(token)}`, { method: "POST" }).then(async (response) => { const body = await response.json().catch(() => ({})); setStatus(response.ok ? (body.alreadyConfirmed ? "Esta confirmacao ja foi registrada." : "Recebimento confirmado com sucesso. Obrigado!") : body.error ?? "Nao foi possivel confirmar."); }); }, [token]);
  return <p className="confirmation-result">{status}</p>;
}
