export type ConnectionHealth = {
  gateway: boolean;
  whatsapp: string;
  title: string;
  detail: string;
  action: string;
  code: "connected" | "whatsapp_disconnected" | "gateway_timeout" | "gateway_unreachable" | "gateway_unauthorized" | "gateway_error" | "status_unavailable";
};

export function connectionHealth(input: { gateway: boolean; whatsapp?: string; httpStatus?: number; error?: unknown }): ConnectionHealth {
  const state = String(input.whatsapp ?? "unknown").toLowerCase();
  if (input.gateway && state === "open") return {
    gateway: true, whatsapp: "open", code: "connected", title: "WhatsApp conectado",
    detail: "A estacao local, o tunel e a conta do WhatsApp estao respondendo normalmente.",
    action: "Nenhuma acao necessaria.",
  };
  if (input.gateway && ["close", "closed", "disconnected"].includes(state)) return {
    gateway: true, whatsapp: state, code: "whatsapp_disconnected", title: "WhatsApp desconectado",
    detail: "A estacao local esta acessivel, mas esta conta nao esta conectada ao WhatsApp.",
    action: "Abra Configuracoes, Contas do WhatsApp e use Conectar / QR.",
  };
  if (input.gateway && state === "connecting") return {
    gateway: true, whatsapp: state, code: "status_unavailable", title: "WhatsApp conectando",
    detail: "A estacao respondeu e a conta ainda esta concluindo a conexao.",
    action: "Aguarde alguns segundos e verifique novamente.",
  };
  if (input.httpStatus === 401 || input.httpStatus === 403) return {
    gateway: false, whatsapp: "unknown", code: "gateway_unauthorized", title: "Acesso ao gateway recusado",
    detail: "O portal alcancou o gateway, mas a chave de acesso nao foi aceita.",
    action: "Solicite ao administrador a revisao da chave da Evolution API na Vercel.",
  };
  if (input.gateway) return {
    gateway: true, whatsapp: state, code: "status_unavailable", title: "Estado do WhatsApp indisponivel",
    detail: "A estacao local respondeu, mas nao informou um estado reconhecido para esta conta.",
    action: "Atualize a consulta. Se continuar, gere um novo QR Code em Configuracoes.",
  };
  const errorName = input.error instanceof Error ? input.error.name : "";
  const errorText = input.error instanceof Error ? input.error.message.toLowerCase() : String(input.error ?? "").toLowerCase();
  if (errorName === "TimeoutError" || errorName === "AbortError" || errorText.includes("timeout")) return {
    gateway: false, whatsapp: "unknown", code: "gateway_timeout", title: "A estacao nao respondeu a tempo",
    detail: "O portal aguardou o gateway local, mas a consulta expirou.",
    action: "Confirme se o Docker esta aberto e se os conteineres Evolution API e Cloudflare estao em execucao.",
  };
  if (!input.httpStatus || errorText.includes("fetch failed") || errorText.includes("network")) return {
    gateway: false, whatsapp: "unknown", code: "gateway_unreachable", title: "Estacao local indisponivel",
    detail: "O portal nao conseguiu alcancar o computador que mantem o WhatsApp conectado.",
    action: "Ligue o computador, abra o Docker e confirme que o tunel Cloudflare esta em execucao.",
  };
  return {
    gateway: false, whatsapp: "unknown", code: "gateway_error", title: "Falha no gateway do WhatsApp",
    detail: `O gateway respondeu com o codigo HTTP ${input.httpStatus}.`,
    action: "Atualize a consulta. Se continuar, verifique os conteineres da Evolution API e do Cloudflare.",
  };
}
