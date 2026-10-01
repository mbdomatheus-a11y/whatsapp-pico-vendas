import { createAdminClient } from "@/lib/supabase/admin";

export async function writeAudit(input: { actorId?: string | null; organizationId?: string | null; groupId?: string | null; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await createAdminClient().from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    organization_id: input.organizationId ?? null,
    group_id: input.groupId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
