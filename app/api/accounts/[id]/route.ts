import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Somente administradores gerenciam contas" }, { status: 403 });
  const { id } = await params;
  const { data } = await auth.supabase.from("whatsapp_accounts").select("instance_name").eq("id", id).eq("enabled", true).single();
  if (!data) return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 });
  const { count: total } = await auth.supabase.from("whatsapp_accounts").select("id", { count: "exact", head: true }).eq("enabled", true);
  if ((total ?? 0) <= 1) return NextResponse.json({ error: "Mantenha pelo menos uma conta cadastrada" }, { status: 400 });
  try {
    await new EvolutionProvider(data.instance_name).deleteInstance();
    const { error } = await auth.supabase.from("whatsapp_accounts").update({ enabled: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao remover conta" }, { status: 400 }); }
}
