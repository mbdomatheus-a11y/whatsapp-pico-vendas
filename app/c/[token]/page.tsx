import { ReadConfirmation } from "@/components/read-confirmation";
export default async function ConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Pico de Vendas</p><h1>Confirmacao de recebimento</h1><ReadConfirmation token={token} /><p className="muted">Este link e individual, expira em sete dias e nao solicita nenhum dado pessoal.</p></section></main>;
}
