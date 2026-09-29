function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
}

export function publicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function serverEnv() {
  return {
    ...publicEnv(),
    supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
    evolutionBaseUrl: required("EVOLUTION_BASE_URL").replace(/\/$/, ""),
    evolutionApiKey: required("EVOLUTION_API_KEY"),
    evolutionInstance: required("EVOLUTION_INSTANCE"),
    cfAccessClientId: process.env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
    authorizedTestNumber: process.env.AUTHORIZED_TEST_NUMBER,
  };
}
