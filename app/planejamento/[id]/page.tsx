import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { PlanningSessionView } from "@/components/planning-session-view";
import { getPortalContext } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PreviewResult } from "@/lib/planning/types";

export const dynamic = "force-dynamic";
export default async function SavedPlanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { access, groups, selectedGroupId } = await getPortalContext();
  const admin = createAdminClient();
  const { data } = await admin.from("planning_sessions").select("id,name,weekday,status,group_id,whatsapp_account_id,source_file_name,segmentation_file_name,selected_filters,preview_payload,use_schedule,expires_at,campaign_id").eq("id", id).maybeSingle();
  if (!data || !access.groups.some((group) => group.group_id === data.group_id)) notFound();
  const { data: accounts } = await admin.from("whatsapp_accounts").select("id,label").eq("organization_id", access.profile.organization_id).eq("enabled", true).order("created_at");
  const session = { ...data, selected_filters: (data.selected_filters ?? {}) as Record<string,string>, preview_payload: data.preview_payload as unknown as PreviewResult };
  return <PortalShell active="planejamento" title="Segmentacao e previa" description="Preparacao salva" fullName={access.profile.full_name} role={access.profile.role} groups={groups} selectedGroupId={selectedGroupId}><div className="page-actions"><a className="button secondary" href="/planejamento">Voltar para preparacoes</a></div><PlanningSessionView session={session} accounts={accounts ?? []} /></PortalShell>;
}
