import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const params = await searchParams;
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Primeiro acesso</p><h1>Crie uma nova senha</h1><p>A senha temporaria precisa ser substituida antes de acessar o portal.</p><form action="/api/auth/change-password" method="post" className="stack"><label>Nova senha<input type="password" name="password" minLength={10} required autoComplete="new-password" /></label><label>Confirmar nova senha<input type="password" name="confirmation" minLength={10} required autoComplete="new-password" /></label><button type="submit">Salvar nova senha</button>{params.error && <div className="alert error">{params.error}</div>}</form></section></main>;
}
