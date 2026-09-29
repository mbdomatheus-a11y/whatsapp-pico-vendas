import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.redirect(new URL("/login?erro=1", request.url), 303);
  const access = await getAccessContext(data.user.id);
  if (!access?.profile.active) { await supabase.auth.signOut(); return NextResponse.redirect(new URL("/login?erro=inativo", request.url), 303); }
  await writeAudit({ actorId: data.user.id, organizationId: access.profile.organization_id, action: "login_password_ok", entityType: "session" });
  if (access.profile.must_change_password) return NextResponse.redirect(new URL("/alterar-senha", request.url), 303);
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasMfa = factors?.totp?.some((factor) => factor.status === "verified");
  return NextResponse.redirect(new URL(hasMfa ? "/seguranca/verificar" : "/seguranca/configurar", request.url), 303);
}
