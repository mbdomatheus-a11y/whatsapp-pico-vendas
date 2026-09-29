import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await params; const body = await request.json().catch(() => ({})); const local = String(body.scheduledAt ?? "");
  const scheduledAt = local ? new Date(`${local}:00-03:00`) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) return NextResponse.json({ error: "Escolha uma data futura" }, { status: 400 });
  const admin = createAdminClient(); const { data: campaign } = await admin.from("campaigns").select("created_by,status").eq("id", id).single();
  if (!campaign || campaign.created_by !== auth.userId || campaign.status === "processando" || campaign.status === "concluida") return NextResponse.json({ error: "Agendamento nao pode mais ser alterado" }, { status: 409 });
  await admin.from("campaigns").update({ scheduled_at: scheduledAt?.toISOString() ?? null }).eq("id", id);
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: scheduledAt ? "campaign_rescheduled" : "campaign_schedule_removed", entityType: "campaign", entityId: id, metadata: { scheduledAt: scheduledAt?.toISOString() ?? null } });
  return NextResponse.json({ ok: true });
}
