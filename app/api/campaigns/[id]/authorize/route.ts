import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await auth.supabase.rpc("authorize_campaign", { target_campaign: id });
  if (!error) await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "campaign_authorized", entityType: "campaign", entityId: id });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json(data);
}
