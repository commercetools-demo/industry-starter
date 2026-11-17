export interface Config {
  projectKey: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authUrl: string;
  apiUrl: string;
  corsOrigin: string;
}

const REQUIRED = ['CTP_PROJECT_KEY', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPE', 'CTP_AUTH_URL', 'CTP_API_URL'] as const;

/** Reads and validates all configuration once, naming every missing key. */
export function readConfiguration(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length > 0) throw new Error(`Invalid environment configuration, missing: ${missing.join(', ')}`);
  return {
    projectKey: env.CTP_PROJECT_KEY!.trim(),
    clientId: env.CTP_CLIENT_ID!.trim(),
    clientSecret: env.CTP_CLIENT_SECRET!.trim(),
    scopes: env.CTP_SCOPE!.trim().split(/\s+/),
    authUrl: env.CTP_AUTH_URL!.trim(),
    apiUrl: env.CTP_API_URL!.trim(),
    corsOrigin: env.CORS_ALLOWED_ORIGIN?.trim() || '*',
  };
}
