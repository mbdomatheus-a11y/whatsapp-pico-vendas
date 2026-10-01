import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";

async function securityDestination(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data: settings } = await createAdminClient().from("system_settings").select("mfa_required").eq("organization_id", organizationId).maybeSingle();
  if (settings?.mfa_required === false) return null;
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
  const destination = await securityDestination(supabase, context.profile.organization_id);
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
  if (await securityDestination(supabase, context.profile.organization_id)) return null;
  return { supabase, userId, access: context };
}
