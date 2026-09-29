import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.redirect(new URL("/login", request.url), 303);
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password.length < 10 || password !== confirmation) return NextResponse.redirect(new URL("/alterar-senha?error=As+senhas+devem+ser+iguais+e+ter+ao+menos+10+caracteres", request.url), 303);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return NextResponse.redirect(new URL(`/alterar-senha?error=${encodeURIComponent(error.message)}`, request.url), 303);
  await supabase.from("user_profiles").update({ must_change_password: false, changed_at: new Date().toISOString() }).eq("user_id", data.claims.sub);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
