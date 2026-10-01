export function normalizeBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55[1-9]\d{9,10}$/.test(digits) ? digits : "";
}

export function formatBrazilianPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "Numero nao informado";
}

export function instanceNameFromPhone(phone: string) {
  return `wa-${phone}`;
}
