import { serverEnv } from "@/lib/env";
import type { MessagingProvider, SendMediaInput, SendTextInput, SendResult } from "./types";
import { connectionHealth } from "./health";

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

function providerError(body: any, status: number, action: string) {
  const detail = body?.response?.message?.[0] ?? body?.response?.message ?? body?.message ?? body?.error;
  if (detail) return typeof detail === "string" ? detail : JSON.stringify(detail);
  if (status === 404) return `${action}: rota nao encontrada no gateway. Confira se a URL publica aponta para a Evolution API na porta 8080.`;
  return `${action}: HTTP ${status}`;
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
      return connectionHealth({ gateway: response.ok, whatsapp: state, httpStatus: response.status });
    } catch (error) {
      return connectionHealth({ gateway: false, whatsapp: "unknown", error });
    }
  }

  async webhookStatus() {
    const env = serverEnv();
    try {
      const response = await fetch(`${env.evolutionBaseUrl}/webhook/find/${encodeURIComponent(this.instance())}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { enabled: false, reachable: false };
      const webhook = body?.webhook ?? body;
      return { enabled: Boolean(webhook?.enabled && webhook?.url), reachable: true, events: webhook?.events ?? [] };
    } catch { return { enabled: false, reachable: false }; }
  }

  async configureInboundWebhook(appUrl: string) {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/webhook/set/${encodeURIComponent(this.instance())}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ webhook: { enabled: true, url: `${appUrl.replace(/\/$/, "")}/api/webhooks/evolution`, headers: { "x-api-key": env.evolutionApiKey }, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.response?.message?.[0] ?? body?.message ?? `HTTP ${response.status}`);
    return body;
  }

  async createInstance() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/create`, { method: "POST", headers: headers(), body: JSON.stringify({ instanceName: this.instance(), qrcode: true, integration: "WHATSAPP-BAILEYS" }), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(providerError(body, response.status, "Nao foi possivel criar a conexao"));
    return body;
  }

  async instanceExists() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(this.instance())}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(providerError(body, response.status, "Nao foi possivel consultar as conexoes"));
    const instances = Array.isArray(body) ? body : Array.isArray(body?.instances) ? body.instances : [];
    return instances.some((item: any) => {
      const name = item?.name ?? item?.instanceName ?? item?.instance?.instanceName ?? item?.instance?.name;
      return name === this.instance();
    });
  }

  async ensureInstance() {
    if (await this.instanceExists()) return false;
    await this.createInstance();
    return true;
  }

  async connect() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/connect/${encodeURIComponent(this.instance())}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(providerError(body, response.status, "Nao foi possivel gerar o QR Code"));
    return body;
  }

  async deleteInstance() {
    const env = serverEnv();
    const response = await fetch(`${env.evolutionBaseUrl}/instance/delete/${encodeURIComponent(this.instance())}`, { method: "DELETE", headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.message ?? `HTTP ${response.status}`); }
  }
}
