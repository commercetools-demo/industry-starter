// Pure validation (no `server-only`) so next.config.ts and instrumentation can call it. Use lib/env.ts from app code.
export type Env = {
  CTP_PROJECT_KEY: string;
  CTP_AUTH_URL: string;
  CTP_API_URL: string;
  CTP_CLIENT_ID: string;
  CTP_CLIENT_SECRET: string;
  CTP_SCOPES: string;
  CTP_CHECKOUT_APP_KEY: string;
  SESSION_SECRET: string;
};

const REQUIRED: (keyof Env)[] = [
  'CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPES', 'CTP_CHECKOUT_APP_KEY', 'SESSION_SECRET',
];

/** Throws naming the FIRST missing variable; never prints values. */
export function validateEnv(source: Record<string, string | undefined> = process.env): Env {
  for (const name of REQUIRED) {
    if (!source[name]) throw new Error(`Missing environment variable: ${name}`);
  }
  if ((source.SESSION_SECRET as string).length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return Object.fromEntries(REQUIRED.map((n) => [n, source[n]])) as Env;
}

/** 'https://api.us-central1.gcp.commercetools.com' → 'us-central1.gcp' */
export function getRegion(apiUrl: string): string {
  return new URL(apiUrl).hostname.replace(/^api\./, '').replace(/\.commercetools\.com$/, '');
}

/** Netlify builds validate the environment so a missing variable fails the build by name (Y). */
export function shouldValidateAtBuild(env: Record<string, string | undefined> = process.env): boolean {
  return env.NETLIFY === 'true';
}
