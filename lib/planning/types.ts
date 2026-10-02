export const WEEKDAYS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type PeakRow = {
  ggl: string;
  regional: string;
  storeCode: string;
  storeName: string;
  phone: string;
  peakWindow: string;
  segments?: Record<string, string>;
};

export type PlannedMessage = {
  gerente_id: string;
  telefone: string;
  mensagem: string;
  loja: string;
  faixa_pico: string;
  colaboradores_no_pico: number | null;
  media_colaboradores_dia?: number | null;
  segmentos?: Record<string, string>;
  message_variant?: number;
};

export type PreviewResult = {
  messages: PlannedMessage[];
  warnings: string[];
  totalRows: number;
  matchedStores: number;
  facets: Record<string, string[]>;
  useSchedule: boolean;
};
