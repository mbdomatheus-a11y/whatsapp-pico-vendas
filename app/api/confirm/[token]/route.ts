import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "Link invalido" }, { status: 400 });
  const tokenHash = createHash("sha256").update(token).digest("hex"); const admin = createAdminClient();
  const { data } = await admin.from("read_confirmations").select("id,confirmed_at,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Este link e invalido ou expirou" }, { status: 410 });
  if (data.confirmed_at) return NextResponse.json({ ok: true, alreadyConfirmed: true });
  await admin.from("read_confirmations").update({ confirmed_at: new Date().toISOString() }).eq("id", data.id).is("confirmed_at", null);
  return NextResponse.json({ ok: true, alreadyConfirmed: false });
}
