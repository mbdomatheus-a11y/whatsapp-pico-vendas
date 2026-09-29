import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ? String(data.claims.sub) : "";
  if (!userId) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel !== "aal2") return NextResponse.json({ error: "Segundo fator nao confirmado" }, { status: 403 });
  const access = await getAccessContext(userId);
  await writeAudit({ actorId: userId, organizationId: access?.profile.organization_id, action: "mfa_verified", entityType: "session" });
  return NextResponse.json({ ok: true });
}
