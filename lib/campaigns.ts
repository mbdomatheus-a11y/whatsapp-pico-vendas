export function campaignStage(status: string, tested: boolean, scheduledAt?: string | null) {
  if (status === "rascunho" && !tested) return "1. Aguardando teste";
  if (status === "rascunho" && tested) return "2. Aguardando autorizacao";
  if (status === "autorizada" && scheduledAt && new Date(scheduledAt).getTime() > Date.now()) return `3. Agendada para ${new Date(scheduledAt).toLocaleString("pt-BR")}`;
  if (status === "autorizada") return "3. Autorizada, pronta para iniciar";
  if (status === "processando") return "4. Envios em andamento";
  if (status === "pausada") return "Pausada";
  if (status === "cancelada") return "Parada definitivamente";
  if (status === "concluida") return "Concluida";
  if (status === "erro") return "Concluida com erros";
  return status;
}

export function suggestedCampaignName(day?: string) {
  const now = new Date();
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(now).replaceAll("/", "_");
  const weekday = day ? day.charAt(0).toUpperCase() + day.slice(1).toLocaleLowerCase("pt-BR") : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(now).replace("-feira", "");
  return `${date}_${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
}
