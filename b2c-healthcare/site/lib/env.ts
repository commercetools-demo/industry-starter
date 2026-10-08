/** Required commercetools variables (all server-only, never NEXT_PUBLIC_). */
export const CT_ENV_VARS = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
] as const;

export type CtEnvVar = (typeof CT_ENV_VARS)[number];

export interface CtConfig {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

type EnvSource = Record<string, string | undefined>;

/**
 * Pure validator: throws an Error naming the first missing variable (never its value),
 * so a misconfiguration is not reported as a commercetools authentication error.
 */
export function validateCtEnv(env: EnvSource = process.env): CtConfig {
  for (const name of CT_ENV_VARS) {
    if (!env[name]?.trim()) {
      throw new Error(`Missing required environment variable ${name}. See .env.example.`);
    }
  }
  const get = (name: CtEnvVar): string => (env[name] as string).trim();
  return {
    projectKey: get('CTP_PROJECT_KEY'),
    authUrl: get('CTP_AUTH_URL'),
    apiUrl: get('CTP_API_URL'),
    clientId: get('CTP_CLIENT_ID'),
    clientSecret: get('CTP_CLIENT_SECRET'),
    scopes: get('CTP_SCOPES').split(/\s+/),
  };
}
