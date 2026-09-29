import { serverEnv } from "@/lib/env";
import type { MessagingProvider, SendTextInput, SendResult } from "./types";

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
  async sendText(input: SendTextInput): Promise<SendResult> {
    const env = serverEnv();
    const response = await fetch(
      `${env.evolutionBaseUrl}/message/sendText/${encodeURIComponent(env.evolutionInstance)}`,
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

  async health() {
    const env = serverEnv();
    try {
      const response = await fetch(
        `${env.evolutionBaseUrl}/instance/connectionState/${encodeURIComponent(env.evolutionInstance)}`,
        { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8_000) },
      );
      const body = await response.json().catch(() => ({}));
      const state = body?.instance?.state ?? body?.state ?? "unknown";
      return { gateway: response.ok, whatsapp: state, detail: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { gateway: false, whatsapp: "unknown", detail: error instanceof Error ? error.message : "Falha desconhecida" };
    }
  }
}
