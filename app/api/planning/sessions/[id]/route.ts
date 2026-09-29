import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

async function getSession(auth: NonNullable<Awaited<ReturnType<typeof requireApiUser>>>, id: string) {
  const { data } = await createAdminClient().from("planning_sessions").select("id,name,group_id,status").eq("id", id).maybeSingle();
  return data && auth.access.groups.some((group) => group.group_id === data.group_id) ? data : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin","operador"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Seu perfil e somente consulta" }, { status: 403 });
  const { id } = await context.params; const session = await getSession(auth, id);
  if (!session) return NextResponse.json({ error: "Preparacao nao encontrada" }, { status: 404 });
  if (session.status === "convertida") return NextResponse.json({ error: "Esta preparacao ja virou campanha" }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const filters = body.filters && typeof body.filters === "object" && !Array.isArray(body.filters) ? body.filters : {};
  if (JSON.stringify(filters).length > 10000) return NextResponse.json({ error: "Filtros invalidos" }, { status: 400 });
  const { error } = await createAdminClient().from("planning_sessions").update({ selected_filters: filters, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "planning_filters_saved", entityType: "planning_session", entityId: id, metadata: { filters } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master","admin","operador"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Seu perfil e somente consulta" }, { status: 403 });
  const { id } = await context.params; const session = await getSession(auth, id);
  if (!session) return NextResponse.json({ error: "Preparacao nao encontrada" }, { status: 404 });
  const { error } = await createAdminClient().from("planning_sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "planning_session_deleted", entityType: "planning_session", entityId: id, metadata: { name: session.name } });
  return NextResponse.json({ ok: true });
}
