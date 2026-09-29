import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  const { count } = await admin.from("test_recipients").select("id", { count: "exact", head: true }).eq("active", true);
  if ((count ?? 0) <= 1) return NextResponse.json({ error: "O grupo precisa manter pelo menos um destinatario ativo" }, { status: 400 });
  const { error } = await admin.from("test_recipients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
