import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

async function securityDestination(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.filter((factor) => factor.status === "verified") ?? [];
  if (!verified.length) return "/seguranca/configurar";
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return "/seguranca/verificar";
  return null;
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const userId = String(data.claims.sub);
  const context = await getAccessContext(userId);
  if (!context) redirect("/login?erro=inativo");
  if (context.profile.must_change_password) redirect("/alterar-senha");
  const destination = await securityDestination(supabase);
  if (destination) redirect(destination);
  return { supabase, userId, access: context };
}

export async function requireApiUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const userId = String(data.claims.sub);
  const context = await getAccessContext(userId);
  if (!context || context.profile.must_change_password) return null;
  if (await securityDestination(supabase)) return null;
  return { supabase, userId, access: context };
}
