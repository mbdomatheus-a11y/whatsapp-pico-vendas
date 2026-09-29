import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : "";
}

async function ensureLegacyRecipient(userId: string) {
  const admin = createAdminClient();
  const { count } = await admin.from("test_recipients").select("id", { count: "exact", head: true });
  const legacy = normalizePhone(serverEnv().authorizedTestNumber ?? "");
  if ((count ?? 0) === 0 && legacy) await admin.from("test_recipients").insert({ label: "Numero de homologacao", phone: legacy, created_by: userId });
}

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  await ensureLegacyRecipient(auth.userId);
  const { data, error } = await createAdminClient().from("test_recipients").select("id,label,phone,active,created_at").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ recipients: (data ?? []).map(({ phone, ...item }) => ({ ...item, maskedPhone: `********${phone.slice(-4)}` })) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const label = String(body.label ?? "").trim(); const phone = normalizePhone(String(body.phone ?? ""));
  if (!label || !phone) return NextResponse.json({ error: "Nome ou telefone invalido" }, { status: 400 });
  const { data, error } = await createAdminClient().from("test_recipients").insert({ label, phone, created_by: auth.userId }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Este telefone ja pertence ao grupo" : error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
