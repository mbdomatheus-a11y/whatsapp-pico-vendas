import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaEnrollment } from "@/components/mfa-enrollment";

export default async function ConfigureMfaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Protecao obrigatoria</p><h1>Ative a verificacao em duas etapas</h1><p>Use o Microsoft Authenticator, Google Authenticator ou outro aplicativo TOTP. Esta configuracao sera exigida nos proximos acessos.</p><MfaEnrollment /></section></main>;
}
