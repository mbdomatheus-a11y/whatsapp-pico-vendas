import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { EvolutionProvider } from "@/lib/messaging/evolution";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const result = await new EvolutionProvider().health();
  await createAdminClient().from("gateway_health").insert({ gateway_online: result.gateway, whatsapp_status: result.whatsapp, detail: result.detail });
  return NextResponse.json(result, { status: result.gateway ? 200 : 503 });
}
