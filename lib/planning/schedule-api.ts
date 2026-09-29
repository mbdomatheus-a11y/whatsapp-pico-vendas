import { serverEnv } from "@/lib/env";
import type { Weekday } from "./types";

type Shift = { escalar?: string; inicioExp?: string; fimExp?: string; inicioAlm?: string; fimAlm?: string };
type ApiRecord = {
  created_at?: string;
  loja_key?: string;
  payload?: { lojaKey?: string; dados?: { schedule?: Record<string, Record<string, Shift | null>> } };
};

const API_DAY: Record<Weekday, string> = {
  SEGUNDA: "SEGUNDA-FEIRA", TERÇA: "TERÇA-FEIRA", QUARTA: "QUARTA-FEIRA", QUINTA: "QUINTA-FEIRA",
  SEXTA: "SEXTA-FEIRA", SABADO: "SÁBADO", DOMINGO: "DOMINGO",
};

function storeKey(value: string | undefined) {
  const raw = String(value ?? "").trim();
  const numericPrefix = raw.match(/^0*(\d+)/)?.[1];
  const clean = numericPrefix ?? raw.replace(/^0+/, "");
  return clean || "0";
}

function minutes(value: string | undefined) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

export class ScheduleDirectory {
  private constructor(private readonly latestByStore: Map<string, ApiRecord>, readonly limited: boolean) {}

  static async load() {
    const env = serverEnv();
    if (!env.escalaApiUrl || !env.escalaApiKey) throw new Error("API de escalas ainda nao configurada");
    const response = await fetch(env.escalaApiUrl, {
      method: "GET", headers: { "x-api-key": env.escalaApiKey }, cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`API de escalas respondeu HTTP ${response.status}`);
    const body = await response.json() as { sucesso?: boolean; dados?: ApiRecord[] };
    if (!body.sucesso || !Array.isArray(body.dados)) throw new Error("Resposta invalida da API de escalas");
    const latest = new Map<string, ApiRecord>();
    for (const record of body.dados) {
      const key = storeKey(record.loja_key ?? record.payload?.lojaKey);
      const current = latest.get(key);
      if (!current || Date.parse(record.created_at ?? "") > Date.parse(current.created_at ?? "")) latest.set(key, record);
    }
    return new ScheduleDirectory(latest, body.dados.length >= 1000);
  }

  countDuringPeak(storeCode: string, day: Weekday, peakWindow: string) {
    return this.metrics(storeCode, day, peakWindow)?.peakCount ?? null;
  }

  metrics(storeCode: string, day: Weekday, peakWindow: string) {
    const record = this.latestByStore.get(storeKey(storeCode));
    if (!record) return null;
    const [peakStartText, peakEndText] = peakWindow.split("-");
    const peakStart = minutes(peakStartText); const peakEnd = minutes(peakEndText);
    if (peakStart == null || peakEnd == null) return null;
    const schedule = record.payload?.dados?.schedule?.[API_DAY[day]] ?? {};
    let count = 0; let staffedMinutes = 0; let earliest: number | null = null; let latest: number | null = null;
    for (const shift of Object.values(schedule)) {
      if (!shift || String(shift.escalar).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() !== "SIM") continue;
      const start = minutes(shift.inicioExp); const end = minutes(shift.fimExp);
      if (start == null || end == null || end <= start) continue;
      const lunchStart = minutes(shift.inicioAlm); const lunchEnd = minutes(shift.fimAlm);
      const lunchMinutes = lunchStart != null && lunchEnd != null && lunchEnd > lunchStart ? lunchEnd - lunchStart : 0;
      staffedMinutes += Math.max(0, end - start - lunchMinutes);
      earliest = earliest == null ? start : Math.min(earliest, start);
      latest = latest == null ? end : Math.max(latest, end);
      if (!overlaps(start, end, peakStart, peakEnd)) continue;
      const fullyAtLunch = lunchStart != null && lunchEnd != null && peakStart >= lunchStart && peakEnd <= lunchEnd;
      if (!fullyAtLunch) count += 1;
    }
    const span = earliest != null && latest != null ? latest - earliest : 0;
    return { peakCount: count, averageDay: span > 0 ? Math.round((staffedMinutes / span) * 10) / 10 : 0 };
  }
}
