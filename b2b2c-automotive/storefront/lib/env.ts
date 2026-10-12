// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Environment validation. No `server-only` (the proxy imports it); no value is ever put in an error message.
export interface CtConfig {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}
export interface AppEnv {
  frontend: CtConfig;
  sessionSecret: string;
  contentoolsOrigin: string;
}

type Env = Record<string, string | undefined>;
export const MIN_SECRET_LENGTH = 32;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function requiredUrl(env: Env, name: string): string {
  const value = required(env, name);
  try {
    new URL(value);
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }
  return value;
}

function secret(env: Env): string {
  const value = required(env, 'SESSION_SECRET');
  if (value.length < MIN_SECRET_LENGTH) throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  return value;
}

export function validateEnv(env: Env): AppEnv {
  const scopes = required(env, 'CTP_SCOPES').split(/\s+/).filter(Boolean);
  return {
    frontend: {
      projectKey: required(env, 'CTP_PROJECT_KEY'),
      authUrl: requiredUrl(env, 'CTP_AUTH_URL'),
      apiUrl: requiredUrl(env, 'CTP_API_URL'),
      clientId: required(env, 'CTP_CLIENT_ID'),
      clientSecret: required(env, 'CTP_CLIENT_SECRET'),
      scopes,
    },
    sessionSecret: secret(env),
    contentoolsOrigin: requiredUrl(env, 'CONTENTOOLS_ORIGIN').replace(/\/+$/, ''),
  };
}

/** The session signing key from `process.env.SESSION_SECRET`. Throws when missing or shorter than 32 characters. */
export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(secret(process.env));
}
