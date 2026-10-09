/** Typed, validated server configuration. Pure: pass `process.env` (or a test object). */
export interface CtpConfig {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
}

export interface FrontendConfig extends CtpConfig {
  defaultStoreKey: string;
}

type Env = Record<string, string | undefined>;

const need = (env: Env, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name} (see site/.env.example)`);
  return value;
};

export function validateEnv(env: Env): FrontendConfig {
  return {
    projectKey: need(env, 'CTP_PROJECT_KEY'),
    authUrl: need(env, 'CTP_AUTH_URL'),
    apiUrl: need(env, 'CTP_API_URL'),
    clientId: need(env, 'CTP_CLIENT_ID'),
    clientSecret: need(env, 'CTP_CLIENT_SECRET'),
    scopes: need(env, 'CTP_SCOPES'),
    defaultStoreKey: need(env, 'CTP_DEFAULT_STORE_KEY'),
  };
}

/** The narrow server-only client for registration (see `provisioningRoot`). Same project, auth and API hosts. */
export function validateProvisioningEnv(env: Env): CtpConfig {
  return {
    projectKey: need(env, 'CTP_PROJECT_KEY'),
    authUrl: need(env, 'CTP_AUTH_URL'),
    apiUrl: need(env, 'CTP_API_URL'),
    clientId: need(env, 'CTP_PROV_CLIENT_ID'),
    clientSecret: need(env, 'CTP_PROV_CLIENT_SECRET'),
    scopes: need(env, 'CTP_PROV_SCOPES'),
  };
}

export const hasProvisioningEnv = (env: Env): boolean => Boolean(env.CTP_PROV_CLIENT_ID && env.CTP_PROV_CLIENT_SECRET && env.CTP_PROV_SCOPES);
