import { SubmitButton } from "@/components/submit-button";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <img className="login-logo" src="/api/branding/logo" alt="Logo da empresa" />
        <p className="eyebrow">Central de comunicacoes</p>
        <h1 className="login-title">WhatsApp <span className="ok-pulse">OK</span></h1>
        <p className="muted">Entre com seu acesso autorizado para revisar e liberar campanhas.</p>
        {params.erro && <p className="alert error">{params.erro === "inativo" ? "Este acesso esta inativo. Fale com o administrador." : "Nao foi possivel entrar. Verifique e-mail e senha."}</p>}
        <form action="/api/auth/login" method="post" className="stack">
          <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
          <SubmitButton idle="Entrar" pending="Entrando..." />
        </form>
        <a className="support-link" href="https://wa.me/5517997423774?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20o%20WhatsApp%20OK." target="_blank" rel="noreferrer">Problemas para entrar? Fale com o administrador</a>
      </section>
    </main>
  );
}
