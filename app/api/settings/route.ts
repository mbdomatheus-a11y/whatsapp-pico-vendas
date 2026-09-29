import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requireRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const { data, error } = await createAdminClient().from("system_settings").select("retention_days,delay_min_seconds,delay_max_seconds,batch_size,batch_pause_minutes,timezone").eq("organization_id", auth.access.profile.organization_id).single();
  return NextResponse.json(error ? { error: error.message } : { settings: data }, { status: error ? 400 : 200 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const access = await requireRole(auth.userId, ["master", "admin"]);
  if (!access) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const values = { retention_days: Number(body.retentionDays), delay_min_seconds: Number(body.delayMin), delay_max_seconds: Number(body.delayMax), batch_size: Number(body.batchSize), batch_pause_minutes: Number(body.batchPause), timezone: "America/Sao_Paulo", updated_by: auth.userId, updated_at: new Date().toISOString() };
  if (!Number.isInteger(values.retention_days) || values.retention_days < 0 || values.retention_days > 3650 || !Number.isInteger(values.delay_min_seconds) || values.delay_min_seconds < 0 || !Number.isInteger(values.delay_max_seconds) || values.delay_max_seconds < values.delay_min_seconds || values.delay_max_seconds > 3600 || !Number.isInteger(values.batch_size) || values.batch_size < 1 || values.batch_size > 500 || !Number.isInteger(values.batch_pause_minutes) || values.batch_pause_minutes < 0 || values.batch_pause_minutes > 1440) return NextResponse.json({ error: "Configuracao fora dos limites permitidos" }, { status: 400 });
  const { error } = await createAdminClient().from("system_settings").update(values).eq("organization_id", access.profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: access.profile.organization_id, action: "settings_updated", entityType: "settings", metadata: { retentionDays: values.retention_days, delay: [values.delay_min_seconds, values.delay_max_seconds], batchSize: values.batch_size, batchPause: values.batch_pause_minutes } });
  return NextResponse.json({ ok: true });
}
