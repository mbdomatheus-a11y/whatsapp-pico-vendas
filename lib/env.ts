function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
}

export function publicEnv() {
  return {
    // O Next.js substitui variaveis NEXT_PUBLIC apenas quando a referencia e estatica.
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function serverEnv() {
  return {
    ...publicEnv(),
    supabaseSecretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    evolutionBaseUrl: required("EVOLUTION_BASE_URL", process.env.EVOLUTION_BASE_URL).replace(/\/$/, ""),
    evolutionApiKey: required("EVOLUTION_API_KEY", process.env.EVOLUTION_API_KEY),
    evolutionInstance: required("EVOLUTION_INSTANCE", process.env.EVOLUTION_INSTANCE),
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
    authorizedTestNumber: process.env.AUTHORIZED_TEST_NUMBER,
    escalaApiUrl: process.env.ESCALA_API_URL,
    escalaApiKey: process.env.ESCALA_API_KEY,
  };
}
