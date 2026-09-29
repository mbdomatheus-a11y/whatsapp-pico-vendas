import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

async function allowedCampaign(auth: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>, id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("campaigns").select("id,name,status,created_by,group_id").eq("id", id).maybeSingle();
  if (!data || !auth.access.groups.some((group) => group.group_id === data.group_id)) return null;
  if (data.created_by !== auth.userId && !["master", "admin"].includes(auth.access.profile.role)) return null;
  return data;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const campaign = await allowedCampaign(auth, id);
  if (!campaign) return NextResponse.json({ error: "Campanha nao encontrada" }, { status: 404 });
  if (campaign.status === "processando") return NextResponse.json({ error: "Pause a campanha antes de arquivar" }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const archived = body.archived === true;
  const { error } = await createAdminClient().from("campaigns").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: archived ? "campaign_archived" : "campaign_unarchived", entityType: "campaign", entityId: id, metadata: { name: campaign.name } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const campaign = await allowedCampaign(auth, id);
  if (!campaign) return NextResponse.json({ error: "Campanha nao encontrada" }, { status: 404 });
  if (["processando", "autorizada"].includes(campaign.status)) return NextResponse.json({ error: "Pause a campanha antes de excluir" }, { status: 409 });
  const admin = createAdminClient();
  const { data: attachments } = await admin.from("campaign_attachments").select("storage_path").eq("campaign_id", id);
  const paths = (attachments ?? []).map((item) => item.storage_path);
  if (paths.length) await admin.storage.from("campaign-attachments").remove(paths);
  const { error } = await admin.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "campaign_deleted", entityType: "campaign", entityId: id, metadata: { name: campaign.name } });
  return NextResponse.json({ ok: true });
}
