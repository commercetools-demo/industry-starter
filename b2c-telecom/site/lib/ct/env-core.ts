// Pure environment validation. No `server-only` import on purpose: next.config.ts and instrumentation.ts import this file.
// Messages name the variable and never print a value.

export type Env = {
  CTP_PROJECT_KEY: string;
  CTP_AUTH_URL: string;
  CTP_API_URL: string;
  CTP_CLIENT_ID: string;
  CTP_CLIENT_SECRET: string;
  CTP_SCOPES: string;
  SESSION_SECRET: string;
  CTP_CHECKOUT_APP_KEY?: string;
};

export type EnvSource = Record<string, string | undefined>;

export const SESSION_SECRET_MIN = 32;

const REQUIRED = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'SESSION_SECRET',
] as const;

const SECRET_LIKE = /CTP|SECRET|SESSION|SEED|PEXELS/;

function missing(name: string): Error {
  return new Error(`Missing environment variable: ${name}`);
}

function assertNoPublicSecrets(source: EnvSource): void {
  for (const name of Object.keys(source)) {
    if (name.startsWith('NEXT_PUBLIC_') && SECRET_LIKE.test(name)) {
      throw new Error(`Secret-like variable must not carry the public prefix: ${name}`);
    }
  }
}

export function validateSessionSecret(value: string | undefined): string {
  if (value === undefined || value === '') throw missing('SESSION_SECRET');
  if (value.length < SESSION_SECRET_MIN) throw new Error('SESSION_SECRET must be at least 32 characters');
  return value;
}

export function validateEnv(source: EnvSource = process.env, opts: { requireCheckout?: boolean } = {}): Env {
  assertNoPublicSecrets(source);
  for (const name of REQUIRED) {
    if (!source[name]) throw missing(name);
  }
  validateSessionSecret(source.SESSION_SECRET);
  if (opts.requireCheckout && !source.CTP_CHECKOUT_APP_KEY) throw missing('CTP_CHECKOUT_APP_KEY');
  const checkout = source.CTP_CHECKOUT_APP_KEY;
  return {
    CTP_PROJECT_KEY: source.CTP_PROJECT_KEY as string,
    CTP_AUTH_URL: source.CTP_AUTH_URL as string,
    CTP_API_URL: source.CTP_API_URL as string,
    CTP_CLIENT_ID: source.CTP_CLIENT_ID as string,
    CTP_CLIENT_SECRET: source.CTP_CLIENT_SECRET as string,
    CTP_SCOPES: source.CTP_SCOPES as string,
    SESSION_SECRET: source.SESSION_SECRET as string,
    ...(checkout ? { CTP_CHECKOUT_APP_KEY: checkout } : {}),
  };
}

export function getCheckoutAppKey(source: EnvSource = process.env): string {
  const value = source.CTP_CHECKOUT_APP_KEY;
  if (!value) throw missing('CTP_CHECKOUT_APP_KEY');
  return value;
}

/** 'https://api.us-central1.gcp.commercetools.com' -> 'us-central1.gcp' */
export function getRegion(apiUrl: string): string {
  const host = new URL(apiUrl).hostname;
  return host.replace(/^api\./, '').replace(/\.commercetools\.com$/, '');
}

export function flag(source: EnvSource, name: string, fallback = false): boolean {
  const value = source[name];
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export function shouldValidateAtBuild(source: EnvSource = process.env): boolean {
  return source.NETLIFY === 'true';
}

/** Netlify builds fail by variable name; local builds validate nothing. */
export function maybeValidateAtBuild(source: EnvSource = process.env): void {
  if (shouldValidateAtBuild(source)) validateEnv(source, { requireCheckout: true });
}
