import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const userId = String(data.claims.sub);
  const { data: profile } = await supabase.from("user_profiles").select("must_change_password").eq("user_id", userId).maybeSingle();
  if (profile?.must_change_password) redirect("/alterar-senha");
  return { supabase, userId };
}

export async function requireApiUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const userId = String(data.claims.sub);
  const { data: profile } = await supabase.from("user_profiles").select("must_change_password").eq("user_id", userId).maybeSingle();
  if (profile?.must_change_password) return null;
  return { supabase, userId };
}
