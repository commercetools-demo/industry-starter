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
export interface PortalEnv extends AppEnv {
  /** Seller-admin client (`CTP_ADMIN_*`). */
  admin: CtConfig;
  /** Registration client (`CTP_PROVISION_*`); `null` outside production when not configured. */
  provisioning: CtConfig | null;
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

function scopesOf(env: Env, name: string): string[] {
  const scopes = required(env, name).split(/\s+/).filter(Boolean);
  if (scopes.length === 0) throw new Error(`Missing environment variable ${name}`);
  return scopes;
}

/** One credential set: `<prefix>CLIENT_ID`, `CLIENT_SECRET`, `SCOPES`, on the shared project key and hosts. */
function config(env: Env, prefix: '' | 'ADMIN_' | 'PROVISION_'): CtConfig {
  return {
    projectKey: required(env, 'CTP_PROJECT_KEY'),
    authUrl: requiredUrl(env, 'CTP_AUTH_URL'),
    apiUrl: requiredUrl(env, 'CTP_API_URL'),
    clientId: required(env, `CTP_${prefix}CLIENT_ID`),
    clientSecret: required(env, `CTP_${prefix}CLIENT_SECRET`),
    scopes: scopesOf(env, `CTP_${prefix}SCOPES`),
  };
}

/** Frontend client, session secret and Contentools origin only (the shared part). */
export function validateEnv(env: Env): AppEnv {
  return {
    frontend: config(env, ''),
    sessionSecret: secret(env),
    contentoolsOrigin: requiredUrl(env, 'CONTENTOOLS_ORIGIN').replace(/\/+$/, ''),
  };
}

/** Portal: the shared part plus the seller-admin client (always) and the provisioning client (set, or required in production). */
export function validatePortalEnv(env: Env): PortalEnv {
  const base = validateEnv(env);
  const admin = config(env, 'ADMIN_');
  const wantsProvisioning = Boolean(env.CTP_PROVISION_CLIENT_ID?.trim()) || env.NODE_ENV === 'production';
  return { ...base, admin, provisioning: wantsProvisioning ? config(env, 'PROVISION_') : null };
}

/** The session signing key from `process.env.SESSION_SECRET`. Throws when missing or shorter than 32 characters. */
export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(secret(process.env));
}
