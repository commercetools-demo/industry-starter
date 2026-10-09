import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';

export type Root = ByProjectKeyRequestBuilder;

/** Every resource this seed creates has this key prefix. */
export const PREFIX = 'mpw-';

export interface SeedEnv {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  expectedProjectKey: string;
}

const REQUIRED = [
  ['SEED_CTP_PROJECT_KEY', 'projectKey'],
  ['SEED_CTP_AUTH_URL', 'authUrl'],
  ['SEED_CTP_API_URL', 'apiUrl'],
  ['SEED_CTP_CLIENT_ID', 'clientId'],
  ['SEED_CTP_CLIENT_SECRET', 'clientSecret'],
  ['SEED_CTP_SCOPES', 'scopes'],
  ['EXPECTED_PROJECT_KEY', 'expectedProjectKey'],
] as const;

/** Reads the seed environment; the error names the missing variable (never prints a value). */
export function readSeedEnv(env: Record<string, string | undefined>): SeedEnv {
  const out: Record<string, string> = {};
  for (const [name, field] of REQUIRED) {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing environment variable ${name} (see seed/.env.example)`);
    out[field] = value;
  }
  return out as unknown as SeedEnv;
}

/**
 * Refuses to run against the wrong project: the key must equal the independently typed EXPECTED_PROJECT_KEY, and a
 * key containing "healthcare" (the other team's project) is always refused.
 */
export function assertSafeProject(projectKey: string, expected: string | undefined): void {
  if (!expected) throw new Error('EXPECTED_PROJECT_KEY is not set');
  if (projectKey !== expected) throw new Error(`Project key mismatch: SEED_CTP_PROJECT_KEY is "${projectKey}" but EXPECTED_PROJECT_KEY is "${expected}"`);
  if (/healthcare/i.test(projectKey)) throw new Error(`Refusing to run against "${projectKey}": that project belongs to another team`);
}

export interface Args {
  dryRun: boolean;
  only?: string;
  manifest?: string;
  confirm?: string;
  count: number;
}

export function parseArgs(argv: string[]): Args {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const count = Number(get('--count') ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  return { dryRun: argv.includes('--dry-run'), only: get('--only'), manifest: get('--manifest'), confirm: get('--confirm'), count };
}

/** Runs actions, or only prints them in dry-run mode. `changes` counts what was (or would be) done. */
export class Runner {
  changes = 0;
  constructor(readonly dryRun: boolean, private readonly log: (line: string) => void = console.log) {}

  async act<T>(description: string, fn: () => Promise<T>): Promise<T | undefined> {
    this.changes += 1;
    this.log(`${this.dryRun ? 'would ' : ''}${description}`);
    return this.dryRun ? undefined : fn();
  }

  note(line: string): void {
    this.log(line);
  }
}

/** Resolves `undefined` when the API answers 404, rethrows anything else. */
export async function findOne<T>(get: () => Promise<{ body: T }>): Promise<T | undefined> {
  try {
    return (await get()).body;
  } catch (e) {
    const status = (e as { statusCode?: number; code?: number }).statusCode ?? (e as { code?: number }).code;
    if (status === 404) return undefined;
    throw e;
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_DIR = path.resolve(HERE, '..');
export const DATA_DIR = path.join(HERE, 'data');

/** Loads `seed/.env` (then `seed/.env.local`, which wins), validates it, builds the API root and confirms the remote project key. */
export async function getAdminRoot(): Promise<{ root: Root; env: SeedEnv }> {
  // dotenv never overrides a value that is already set, so the file that should win is loaded first.
  loadDotenv({ path: path.join(SEED_DIR, '.env.local') });
  loadDotenv({ path: path.join(SEED_DIR, '.env') });
  const env = readSeedEnv(process.env);
  assertSafeProject(env.projectKey, env.expectedProjectKey);
  const client = new ClientBuilder()
    .withProjectKey(env.projectKey)
    .withClientCredentialsFlow({
      host: env.authUrl,
      projectKey: env.projectKey,
      credentials: { clientId: env.clientId, clientSecret: env.clientSecret },
      scopes: env.scopes.split(/[\s,]+/).filter(Boolean),
      httpClient: fetch,
    })
    .withHttpMiddleware({ host: env.apiUrl, httpClient: fetch })
    .build();
  const root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.projectKey });
  const remote = (await root.get().execute()).body;
  if (remote.key !== env.projectKey) throw new Error(`The API answered for project "${remote.key}", expected "${env.projectKey}"`);
  assertSafeProject(remote.key, env.expectedProjectKey);
  return { root, env };
}


/** True when a stored URL is clean (a valid absolute URL with no query and no fragment). */
export function isCleanUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.search === '' && url.hash === '' && !raw.includes('?') && !raw.includes('#');
  } catch {
    return false;
  }
}
