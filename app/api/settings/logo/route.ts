import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);

function validSignature(type: string, bytes: Uint8Array) {
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  if (!["master", "admin"].includes(auth.access.profile.role)) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const form = await request.formData();
  const logo = form.get("logo");
  if (!(logo instanceof File) || !allowed.has(logo.type) || logo.size < 1 || logo.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Use PNG, JPG ou WebP de ate 2 MB" }, { status: 400 });
  const bytes = new Uint8Array(await logo.arrayBuffer());
  if (!validSignature(logo.type, bytes)) return NextResponse.json({ error: "O conteudo do arquivo nao corresponde a uma imagem valida" }, { status: 400 });
  const path = `${auth.access.profile.organization_id}/company-logo`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("brand-assets").upload(path, bytes, { contentType: logo.type, upsert: true, cacheControl: "300" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const { error } = await admin.from("system_settings").update({ logo_storage_path: path, logo_mime_type: logo.type, updated_by: auth.userId, updated_at: new Date().toISOString() }).eq("organization_id", auth.access.profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAudit({ actorId: auth.userId, organizationId: auth.access.profile.organization_id, action: "company_logo_updated", entityType: "settings" });
  return NextResponse.json({ ok: true });
}
