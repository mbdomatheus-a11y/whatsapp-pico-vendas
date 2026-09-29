import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const groupId = new URL(request.url).searchParams.get("groupId") ?? auth.access.preference?.selected_group_id;
  if (!groupId || !auth.access.groups.some((item) => item.group_id === groupId)) return NextResponse.json({ error: "Grupo invalido" }, { status: 400 });
  const admin = createAdminClient(); const { data, error } = await admin.from("communication_logs").select("id,campaign_id,message_id,recipient_label,destination_masked,message_text,attachment_names,sent_at,expires_at,campaigns(name)").eq("group_id", groupId).order("sent_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const messageIds = (data ?? []).map((item) => item.message_id).filter(Boolean);
  const { data: confirmations } = messageIds.length ? await admin.from("read_confirmations").select("message_id,confirmed_at,expires_at").in("message_id", messageIds) : { data: [] };
  return NextResponse.json({ items: (data ?? []).map((item) => ({ ...item, confirmation: confirmations?.find((confirmation) => confirmation.message_id === item.message_id) ?? null })) });
}
