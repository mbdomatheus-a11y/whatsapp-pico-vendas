import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const groupId = new URL(request.url).searchParams.get("groupId") ?? auth.access.preference?.selected_group_id;
  if (!groupId || !auth.access.groups.some((item) => item.group_id === groupId)) return NextResponse.json({ error: "Grupo invalido" }, { status: 400 });
  const { data, error } = await createAdminClient().from("inbound_events")
    .select("id,event_type,sender_masked,content,received_at,campaigns(name)")
    .eq("group_id", groupId).order("received_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Nao foi possivel carregar respostas e reacoes" }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
