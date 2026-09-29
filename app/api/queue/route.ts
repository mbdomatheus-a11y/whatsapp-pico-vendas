import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  let query = auth.supabase.from("message_queue")
    .select("id,campaign_id,gerente_id,status,tentativas,destination_masked,erro,enviado_em,created_at,sequence_number,campaigns(name)")
    .order("created_at", { ascending: false }).order("sequence_number", { ascending: true }).limit(500);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const totals: Record<string, number> = {};
  for (const item of data ?? []) totals[item.status] = (totals[item.status] ?? 0) + 1;
  return NextResponse.json({ items: data ?? [], totals });
}
