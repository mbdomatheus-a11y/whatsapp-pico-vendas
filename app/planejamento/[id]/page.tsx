import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { PlanningSessionView } from "@/components/planning-session-view";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PreviewResult } from "@/lib/planning/types";

export const dynamic = "force-dynamic";
export default async function SavedPlanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { access, groups, selectedGroupId } = await getPortalContext();
  const { data } = await createAdminClient().from("planning_sessions").select("id,name,weekday,status,group_id,whatsapp_account_id,source_file_name,segmentation_file_name,selected_filters,preview_payload,expires_at,campaign_id").eq("id", id).maybeSingle();
  if (!data || !access.groups.some((group) => group.group_id === data.group_id)) notFound();
  const session = { ...data, selected_filters: (data.selected_filters ?? {}) as Record<string,string>, preview_payload: data.preview_payload as unknown as PreviewResult };
  return <PortalShell active="planejamento" title="Segmentacao e previa" description="Preparacao salva" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><div className="page-actions"><a className="button secondary" href="/planejamento">Voltar para preparacoes</a></div><PlanningSessionView session={session} /></PortalShell>;
}
