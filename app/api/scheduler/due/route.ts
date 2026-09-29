import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const auth = await requireApiUser(); if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const now = new Date().toISOString(); const { data, error } = await createAdminClient().from("campaigns").select("id,name").eq("created_by", auth.userId).eq("status", "autorizada").not("scheduled_at", "is", null).lte("scheduled_at", now).limit(5);
  return NextResponse.json(error ? { error: error.message } : { campaigns: data ?? [] }, { status: error ? 400 : 200 });
}
