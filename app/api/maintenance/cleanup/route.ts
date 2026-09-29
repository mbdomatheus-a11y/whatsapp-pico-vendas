import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST() {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const admin = createAdminClient(); const now = new Date().toISOString();
  const { data: expired } = await admin.from("communication_logs").select("id,campaign_id").eq("organization_id", auth.access.profile.organization_id).not("expires_at", "is", null).lt("expires_at", now).limit(1000);
  if (expired?.length) await admin.from("communication_logs").delete().in("id", expired.map((item) => item.id));
  await admin.from("read_confirmations").delete().lt("expires_at", now);
  const campaignIds = [...new Set((expired ?? []).map((item) => item.campaign_id).filter(Boolean))];
  for (const campaignId of campaignIds) {
    const { count } = await admin.from("communication_logs").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
    const { data: campaign } = await admin.from("campaigns").select("status").eq("id", campaignId).single();
    if ((count ?? 0) === 0 && ["concluida","erro"].includes(campaign?.status ?? "")) {
      const { data: files } = await admin.from("campaign_attachments").select("storage_path").eq("campaign_id", campaignId);
      if (files?.length) await admin.storage.from("campaign-attachments").remove(files.map((file) => file.storage_path));
      await admin.from("campaign_attachments").delete().eq("campaign_id", campaignId);
    }
  }
  return NextResponse.json({ removedLogs: expired?.length ?? 0 });
}
