import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const { error } = await auth.supabase.from("campaigns").update({ status: "pausada" }).eq("id", id).in("status", ["autorizada", "processando"]);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
