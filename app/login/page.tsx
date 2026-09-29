export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Operacao comercial</p>
        <h1>Pico de Vendas</h1>
        <p className="muted">Entre com seu acesso autorizado para revisar e liberar campanhas.</p>
        {params.erro && <p className="alert error">Nao foi possivel entrar. Verifique e-mail e senha.</p>}
        <form action="/api/auth/login" method="post" className="stack">
          <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
