import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const groupId = String(body.selectedGroupId ?? "");
  if (!auth.access.groups.some((item) => item.group_id === groupId)) return NextResponse.json({ error: "Grupo invalido" }, { status: 400 });
  const { error } = await createAdminClient().from("user_preferences").upsert({ user_id: auth.userId, selected_group_id: groupId, updated_at: new Date().toISOString() });
  return NextResponse.json(error ? { error: error.message } : { ok: true }, { status: error ? 400 : 200 });
}
