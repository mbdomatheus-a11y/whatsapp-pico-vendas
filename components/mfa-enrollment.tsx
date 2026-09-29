"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function MfaEnrollment() {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true); setError("");
    const supabase = createBrowserSupabase();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Portal Pico ${new Date().toLocaleDateString("pt-BR")}` });
    if (enrollError) setError(enrollError.message);
    else { setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); }
    setBusy(false);
  }

  async function finish() {
    if (!factorId || code.length !== 6) return;
    setBusy(true); setError("");
    const supabase = createBrowserSupabase();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) { setError("Codigo invalido. Confira o relogio do celular e tente novamente."); setBusy(false); return; }
    await fetch("/api/auth/mfa-complete", { method: "POST" });
    router.replace("/dashboard"); router.refresh();
  }

  return <div className="stack">
    {!factorId && <button onClick={begin} disabled={busy}>{busy ? "Preparando..." : "Gerar QR Code de seguranca"}</button>}
    {factorId && <>
      <div className="mfa-qr">{qrCode && <img src={qrCode} alt="QR Code para aplicativo autenticador" />}</div>
      <p className="muted">Se nao puder ler o QR Code, digite esta chave no autenticador:</p>
      <code className="secret-code">{secret}</code>
      <label>Codigo de 6 digitos<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></label>
      <button onClick={finish} disabled={busy || code.length !== 6}>{busy ? "Validando..." : "Ativar e entrar"}</button>
    </>}
    {error && <div className="alert error">{error}</div>}
  </div>;
}
