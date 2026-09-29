"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function MfaChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true); setError("");
    const supabase = createBrowserSupabase();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((item) => item.status === "verified");
    if (!factor) { router.replace("/seguranca/configurar"); return; }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) setError("Codigo invalido. Tente novamente.");
    else { await fetch("/api/auth/mfa-complete", { method: "POST" }); router.replace("/dashboard"); router.refresh(); }
    setBusy(false);
  }
  return <div className="stack"><label>Codigo do autenticador<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus /></label><button onClick={verify} disabled={busy || code.length !== 6}>{busy ? "Validando..." : "Confirmar acesso"}</button>{error && <div className="alert error">{error}</div>}</div>;
}
