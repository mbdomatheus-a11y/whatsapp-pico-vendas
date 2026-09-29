import { serverEnv } from "@/lib/env";
import type { MessagingProvider, SendMediaInput, SendTextInput, SendResult } from "./types";

function headers() {
  const env = serverEnv();
  return {
    "Content-Type": "application/json",
    apikey: env.evolutionApiKey,
    ...(env.cfAccessClientId && env.cfAccessClientSecret
      ? {
          "CF-Access-Client-Id": env.cfAccessClientId,
          "CF-Access-Client-Secret": env.cfAccessClientSecret,
        }
      : {}),
  };
}

export class EvolutionProvider implements MessagingProvider {
  constructor(private readonly instanceName?: string) {}

  private instance() { return this.instanceName ?? serverEnv().evolutionInstance; }

  async sendText(input: SendTextInput): Promise<SendResult> {
    const env = serverEnv();
    const response = await fetch(
      `${env.evolutionBaseUrl}/message/sendText/${encodeURIComponent(this.instance())}`,
      {
        method: "POST",
        headers: { ...headers(), "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({ number: input.destination, text: input.text }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { success: false, error: body?.message ?? `HTTP ${response.status}` };
    return { success: true, externalId: body?.key?.id ?? body?.messageId };
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    const env = serverEnv();
    const mediaType = input.mimeType === "application/pdf" ? "document" : "image";
    const response = await fetch(`${env.evolutionBaseUrl}/message/sendMedia/${encodeURIComponent(this.instance())}`, {
      method: "POST",
      headers: { ...headers(), "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ number: input.destination, mediatype: mediaType, mimetype: input.mimeType, media: input.mediaUrl, fileName: input.fileName, caption: input.text }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { success: false, error: body?.message ?? `HTTP ${response.status}` };
    return { success: true, externalId: body?.key?.id ?? body?.messageId };
  }

  async health() {
    const env = serverEnv();
    try {
      const response = await fetch(
        `${env.evolutionBaseUrl}/instance/connectionState/${encodeURIComponent(this.instance())}`,
        { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8_000) },
      );
      const body = await response.json().catch(() => ({}));
      const state = body?.instance?.state ?? body?.state ?? "unknown";
      return { gateway: response.ok, whatsapp: state, detail: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { gateway: false, whatsapp: "unknown", detail: error instanceof Error ? error.message : "Falha desconhecida" };
    }
  }

  async createInstance() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/create`, { method: "POST", headers: headers(), body: JSON.stringify({ instanceName: this.instance(), qrcode: true, integration: "WHATSAPP-BAILEYS" }), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
    return body;
  }

  async connect() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/connect/${encodeURIComponent(this.instance())}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
    return body;
  }

  async deleteInstance() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/delete/${encodeURIComponent(this.instance())}`, { method: "DELETE", headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.message ?? `HTTP ${response.status}`); }
  }
}
