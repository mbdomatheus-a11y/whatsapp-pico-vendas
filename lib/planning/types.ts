export const WEEKDAYS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type PeakRow = {
  ggl: string;
  regional: string;
  storeCode: string;
  storeName: string;
  phone: string;
  peakWindow: string;
};

export type PlannedMessage = {
  gerente_id: string;
  telefone: string;
  mensagem: string;
  loja: string;
  faixa_pico: string;
  colaboradores_no_pico: number;
};

export type PreviewResult = {
  messages: PlannedMessage[];
  warnings: string[];
  totalRows: number;
  matchedStores: number;
};
