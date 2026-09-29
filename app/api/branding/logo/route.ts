import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: settings } = await admin.from("system_settings").select("logo_storage_path,logo_mime_type").not("logo_storage_path", "is", null).limit(1).maybeSingle();
  if (!settings?.logo_storage_path) {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#4A4E58"/><text x="64" y="77" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#FBF2A3">W</text><circle cx="98" cy="31" r="20" fill="#128C7E"/><text x="98" y="37" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#fff">OK</text></svg>`;
    return new NextResponse(fallback, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
  }
  const { data, error } = await admin.storage.from("brand-assets").download(settings.logo_storage_path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": settings.logo_mime_type ?? data.type ?? "image/png", "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
