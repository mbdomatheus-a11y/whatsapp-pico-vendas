"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LogoManager() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/settings/logo", { method: "POST", body: new FormData(form) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Logo atualizado. A guia e o login usarao a nova imagem." : body.error ?? "Falha ao atualizar logo");
    setBusy(false); if (response.ok) { form.reset(); router.refresh(); }
  }
  return <section className="panel"><div className="panel-heading"><div><h2>Logo da empresa</h2><p>Use PNG, JPG ou WebP de ate 2 MB. A imagem aparece no login, no cabecalho e na guia do navegador.</p></div><img className="logo-preview" src="/api/branding/logo" alt="Logo atual" /></div><form className="inline-form" onSubmit={upload}><label>Nova imagem<input name="logo" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button disabled={busy}>{busy ? "Enviando logo..." : "Salvar novo logo"}</button></form>{message && <p className="action-message">{message}</p>}</section>;
}
