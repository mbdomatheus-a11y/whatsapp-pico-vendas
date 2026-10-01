import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns").select("id,name,status,created_by,group_id").eq("id", id).maybeSingle();
  const allowedGroup = campaign && auth.access.groups.some((group) => group.group_id === campaign.group_id);
  const allowedRole = campaign?.created_by === auth.userId || ["master","admin"].includes(auth.access.profile.role);
  if (!campaign || !allowedGroup || !allowedRole) return NextResponse.json({ error: "Campanha nao encontrada" }, { status: 404 });
  if (campaign.status === "cancelada") return NextResponse.json({ ok: true, cancelled: 0 });
  if (!["autorizada","processando","pausada"].includes(campaign.status)) return NextResponse.json({ error: "Esta campanha nao pode ser parada nesta etapa" }, { status: 409 });
  const { data, error } = await admin.rpc("stop_campaign", { target_campaign: id });
  if (error) return NextResponse.json({ error: "Nao foi possivel parar a campanha" }, { status: 500 });
  const cancelled = Number(data?.cancelled ?? 0);
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "campaign_stopped", entityType: "campaign", entityId: id, metadata: { name: campaign.name, cancelled } });
  return NextResponse.json({ ok: true, cancelled });
}
