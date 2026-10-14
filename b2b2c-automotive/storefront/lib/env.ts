// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Environment validation. No `server-only` (the proxy imports it); no value is ever put in an error message.
import { normalizeContentoolsOrigin } from '@/lib/contentools/origin';

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
  /** Signs the private link of a confirmation page (workstream P); never shared with the session. */
  orderAccessSecret: string;
  contentoolsOrigin: string;
  geocoder: GeocoderEnv;
}
/** Address search for the store picker (workstream I). `GEOCODER=off` disables it; otherwise a contact address is required. */
export type GeocoderEnv = { enabled: false } | { enabled: true; url: string; contact: string };

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

function secret(env: Env, name = 'SESSION_SECRET'): string {
  const value = required(env, name);
  if (value.length < MIN_SECRET_LENGTH) throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  return value;
}

/** `NOMINATIM_CONTACT` (the usage policy needs an identifying contact) is only required when geocoding is on. */
export function geocoderEnv(env: Env): GeocoderEnv {
  if (env.GEOCODER?.trim().toLowerCase() === 'off') return { enabled: false };
  const url = env.GEOCODER_URL?.trim() ? requiredUrl(env, 'GEOCODER_URL') : 'https://nominatim.openstreetmap.org';
  return { enabled: true, url: url.replace(/\/+$/, ''), contact: required(env, 'NOMINATIM_CONTACT') };
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
    orderAccessSecret: secret(env, 'ORDER_ACCESS_SECRET'),
    contentoolsOrigin: normalizeContentoolsOrigin(requiredUrl(env, 'CONTENTOOLS_ORIGIN')),
    geocoder: geocoderEnv(env),
  };
}

/** The session signing key from `process.env.SESSION_SECRET`. Throws when missing or shorter than 32 characters. */
export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(secret(process.env));
}

/** The key of the order confirmation link from `process.env.ORDER_ACCESS_SECRET` (not the session secret). Throws when missing or shorter than 32 characters. */
export function getOrderAccessSecret(): Uint8Array {
  return new TextEncoder().encode(secret(process.env, 'ORDER_ACCESS_SECRET'));
}

/**
 * The key shared with the portal for the "Shop as customer" handoff (`process.env.IMPERSONATION_SECRET`, V-06). `null` when it is missing or
 * shorter than 32 characters: the feature is then off and `/api/impersonate` answers the generic not-found page. Never put it in a message.
 */
export function getImpersonationSecret(env: Env = process.env): Uint8Array | null {
  const value = env.IMPERSONATION_SECRET?.trim();
  return value && value.length >= MIN_SECRET_LENGTH ? new TextEncoder().encode(value) : null;
}
