import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaChallenge } from "@/components/mfa-challenge";

export default async function VerifyMfaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Segunda etapa</p><h1>Confirme sua identidade</h1><p>Digite o codigo atual do seu aplicativo autenticador.</p><MfaChallenge /></section></main>;
}
