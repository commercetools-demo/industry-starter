// Seed framework barrel and the ONLY place (besides lib/ct/client.ts) that builds a commercetools client.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ClientBuilder } from '@commercetools/ts-client';
import { assertEchoedKey, assertTarget, type Mode } from './config';

export * from './config';

export type Query = Record<string, string | number | string[]>;

export interface CtApi {
  /** Path is relative to the project ('' is the project itself). Returns null on 404. */
  get(path: string, query?: Query): Promise<unknown | null>;
  post(path: string, body: unknown): Promise<unknown>;
  del(path: string, query: { version: number }): Promise<unknown>;
  /** Incremented by post and del. */
  writes: number;
}

/** An HTTP error from the platform (or from the fake), with the first error code. */
export class CtHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CtHttpError';
  }
}

export type SeedEnv = {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

/** Parses KEY=value lines. Never logs values. Values already in the given environment win. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

export function loadSeedEnv(file = '.env.seed', source: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  let fromFile: Record<string, string> = {};
  try {
    fromFile = parseEnvText(readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  } catch {
    // no file: the process environment alone is used
  }
  return { ...fromFile, ...Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== '')) };
}

const REQUIRED_SEED = ['CTP_SEED_PROJECT_KEY', 'CTP_SEED_AUTH_URL', 'CTP_SEED_API_URL', 'CTP_SEED_CLIENT_ID', 'CTP_SEED_CLIENT_SECRET'] as const;

export function readSeedEnv(source: Record<string, string | undefined>): SeedEnv {
  for (const name of REQUIRED_SEED) {
    if (!source[name]) throw new Error(`Missing environment variable: ${name} (see .env.seed.example)`);
  }
  return {
    projectKey: source.CTP_SEED_PROJECT_KEY as string,
    authUrl: source.CTP_SEED_AUTH_URL as string,
    apiUrl: source.CTP_SEED_API_URL as string,
    clientId: source.CTP_SEED_CLIENT_ID as string,
    clientSecret: source.CTP_SEED_CLIENT_SECRET as string,
    scopes: (source.CTP_SEED_SCOPES ?? '').split(' ').filter(Boolean),
  };
}

function toHttpError(err: unknown): CtHttpError {
  const e = err as { statusCode?: number; code?: number | string; message?: string; body?: { errors?: { code?: string; message?: string }[]; message?: string } };
  const status = e.statusCode ?? (typeof e.code === 'number' ? e.code : 0);
  const first = e.body?.errors?.[0];
  return new CtHttpError(status, first?.message ?? e.body?.message ?? e.message ?? 'request failed', first?.code);
}

function buildUri(projectKey: string, apiPath: string, query?: Query): string {
  const base = apiPath === '' ? `/${projectKey}` : `/${projectKey}/${apiPath.replace(/^\//, '')}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) for (const item of v) params.append(k, item);
    else params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function createApi(env: SeedEnv): CtApi {
  const client = new ClientBuilder()
    .withProjectKey(env.projectKey)
    .withClientCredentialsFlow({
      host: env.authUrl,
      projectKey: env.projectKey,
      credentials: { clientId: env.clientId, clientSecret: env.clientSecret },
      ...(env.scopes.length ? { scopes: env.scopes } : {}),
    })
    .withHttpMiddleware({
      host: env.apiUrl,
      enableRetry: true,
      retryConfig: { maxRetries: 3, retryDelay: 200, backoff: true, retryCodes: [429, 500, 502, 503, 504] },
    })
    .build();

  const api: CtApi = {
    writes: 0,
    async get(p, query) {
      try {
        const res = await client.execute({ method: 'GET', uri: buildUri(env.projectKey, p, query) });
        return res.body;
      } catch (err) {
        const e = toHttpError(err);
        if (e.statusCode === 404) return null;
        throw e;
      }
    },
    async post(p, body) {
      api.writes += 1;
      try {
        const res = await client.execute({ method: 'POST', uri: buildUri(env.projectKey, p), body: body as Record<string, unknown>, headers: { 'Content-Type': 'application/json' } });
        return res.body;
      } catch (err) {
        throw toHttpError(err);
      }
    },
    async del(p, query) {
      api.writes += 1;
      try {
        const res = await client.execute({ method: 'DELETE', uri: buildUri(env.projectKey, p, query) });
        return res.body;
      } catch (err) {
        throw toHttpError(err);
      }
    },
  };
  return api;
}

/**
 * Builds the admin client after the target check, then proves the credentials belong to the named project.
 * Throws TargetError (exit code 2) on any violation.
 */
export async function getAdminApi(opts: { mode: Mode; confirmProject?: string; source?: Record<string, string | undefined> }): Promise<{ api: CtApi; projectKey: string }> {
  const env = readSeedEnv(opts.source ?? loadSeedEnv());
  assertTarget({ envProjectKey: env.projectKey, confirmProject: opts.confirmProject, mode: opts.mode });
  const api = createApi(env);
  const project = (await api.get('')) as { key?: string } | null;
  assertEchoedKey(env.projectKey, project?.key);
  return { api, projectKey: env.projectKey };
}
