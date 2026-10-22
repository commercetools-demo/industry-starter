// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { sdkApi, type Api } from './api';
import { PREFIX } from './data/base';

export { PREFIX };

export interface SeedEnv {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  expectedProjectKey: string;
}

type EnvMap = Record<string, string | undefined>;

const REQUIRED: [field: keyof SeedEnv, names: string[]][] = [
  ['projectKey', ['SEED_CTP_PROJECT_KEY']],
  ['authUrl', ['SEED_CTP_AUTH_URL']],
  ['apiUrl', ['SEED_CTP_API_URL']],
  ['clientId', ['SEED_CTP_CLIENT_ID']],
  ['clientSecret', ['SEED_CTP_CLIENT_SECRET']],
  ['scopes', ['SEED_CTP_SCOPES']],
  ['expectedProjectKey', ['EXPECTED_PROJECT_KEY']],
];

/** Reads the seed environment; the error names the missing variable (never prints a value). */
export function readSeedEnv(env: EnvMap): SeedEnv {
  const out: Partial<SeedEnv> = {};
  for (const [field, names] of REQUIRED) {
    const value = names.map((n) => env[n]?.trim()).find(Boolean);
    if (!value) throw new Error(`Missing environment variable ${names[0]} (see seed/.env.example)`);
    out[field] = value;
  }
  return out as SeedEnv;
}

/**
 * Refuses to run against the wrong project: the key must equal the independently typed EXPECTED_PROJECT_KEY, and a
 * key containing "health" (another team's project) is always refused. Prints both keys on a mismatch (keys are not secret).
 */
export function assertSafeProject(projectKey: string, expected: string | undefined): void {
  if (!expected) throw new Error('EXPECTED_PROJECT_KEY is not set');
  if (projectKey !== expected) throw new Error(`Project key mismatch: SEED_CTP_PROJECT_KEY is "${projectKey}" but EXPECTED_PROJECT_KEY is "${expected}"`);
  if (/health/i.test(projectKey)) throw new Error(`Refusing to run against "${projectKey}": that project belongs to another team`);
}

/** Compares the key the API reports with the configured one (second half of the guard). */
export function assertRemoteKey(remoteKey: string, configured: string, expected: string): void {
  if (remoteKey !== configured) throw new Error(`The API answered for project "${remoteKey}", but SEED_CTP_PROJECT_KEY is "${configured}" (EXPECTED_PROJECT_KEY "${expected}")`);
  assertSafeProject(remoteKey, expected);
}

/** True for exactly one local part and the domain example.com (case-insensitive): the reserved domain test customers use. */
export const isExampleEmail = (email: string | undefined): boolean => !!email && /^[^@\s]+@example\.com$/i.test(email.trim());

export interface Args {
  dryRun: boolean;
  offline: boolean;
  only?: string;
  confirm?: string;
  manifest?: string;
}

export function parseArgs(argv: string[]): Args {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  return { dryRun: argv.includes('--dry-run'), offline: argv.includes('--offline'), only: get('--only'), confirm: get('--confirm'), manifest: get('--manifest') };
}

/** Runs actions, or only prints them in dry-run mode. `changes` counts what was (or would be) done. */
export class Runner {
  changes = 0;
  readonly lines: string[] = [];
  constructor(readonly dryRun: boolean, private readonly log: (line: string) => void = console.log) {}

  async act<T>(description: string, fn: () => Promise<T>): Promise<T | undefined> {
    this.changes += 1;
    const line = `${this.dryRun ? 'would ' : ''}${description}`;
    this.lines.push(line);
    this.log(line);
    return this.dryRun ? undefined : fn();
  }

  note(line: string): void {
    this.log(line);
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_DIR = path.resolve(HERE, '..');
export const DATA_DIR = path.join(HERE, 'data');
export const DEFAULT_MANIFEST = path.join(SEED_DIR, 'cleanup-manifest.json');

/** Loads `seed/.env.local` (wins) then `seed/.env` into process.env. */
export function loadDotenvFiles(): void {
  loadDotenv({ path: path.join(SEED_DIR, '.env.local') });
  loadDotenv({ path: path.join(SEED_DIR, '.env') });
}

/** Loads the env files, validates and applies the first guard. No network. */
export function loadEnv(): { env: SeedEnv; demoPassword: string; imageSourceUrl?: string } {
  loadDotenvFiles();
  const env = readSeedEnv(process.env);
  assertSafeProject(env.projectKey, env.expectedProjectKey);
  return { env, demoPassword: process.env.SEED_DEMO_PASSWORD ?? '', imageSourceUrl: process.env.IMAGE_SOURCE_URL?.trim() || undefined };
}

/** Builds the API client and confirms the key the API itself reports (second guard). */
export async function connect(env: SeedEnv): Promise<Api> {
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
  assertRemoteKey(remote.key, env.projectKey, env.expectedProjectKey);
  return sdkApi(root);
}

export async function getAdmin(): Promise<{ api: Api; env: SeedEnv; demoPassword: string }> {
  const { env, demoPassword } = loadEnv();
  return { api: await connect(env), env, demoPassword };
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

export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  return !!entry && path.resolve(entry) === fileURLToPath(metaUrl);
}

export function fail(e: unknown): never {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
