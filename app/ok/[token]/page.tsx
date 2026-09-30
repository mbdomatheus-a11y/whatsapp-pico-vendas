import { ReadConfirmation } from "@/components/read-confirmation";

export default async function FriendlyConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="login-shell"><section className="login-card"><img className="login-logo" src="/api/branding/logo" alt=""/><p className="eyebrow">WhatsApp OK</p><h1>Confirmar recebimento</h1><ReadConfirmation token={token}/><p className="muted">Este link e individual, expira em sete dias e nao solicita nenhum dado pessoal.</p></section></main>;
}
