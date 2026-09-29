import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").eq("organization_id", auth.access.profile.organization_id).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const actorIds = [...new Set((data ?? []).map((item) => item.actor_id).filter(Boolean))];
  const { data: profiles } = actorIds.length ? await admin.from("user_profiles").select("user_id,full_name").in("user_id", actorIds) : { data: [] };
  return NextResponse.json({ logs: (data ?? []).map((item) => ({ ...item, actorName: profiles?.find((profile) => profile.user_id === item.actor_id)?.full_name ?? "Sistema" })) });
}
