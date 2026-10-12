// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { sdkApi, type Api } from './api';

/** Every resource this seed creates has this key prefix. */
export const PREFIX = 'mau-';

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
  ['authUrl', ['SEED_CTP_AUTH_URL', 'AUTH_URL']],
  ['apiUrl', ['SEED_CTP_API_URL', 'API_URL']],
  ['clientId', ['SEED_CTP_CLIENT_ID', 'CLIENT_ID']],
  ['clientSecret', ['SEED_CTP_CLIENT_SECRET', 'CLIENT_SECRET']],
  ['scopes', ['SEED_CTP_SCOPES', 'SCOPES']],
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
 * key containing "healthcare" (another team's project) is always refused.
 */
export function assertSafeProject(projectKey: string, expected: string | undefined): void {
  if (!expected) throw new Error('EXPECTED_PROJECT_KEY is not set');
  if (projectKey !== expected) throw new Error(`Project key mismatch: SEED_CTP_PROJECT_KEY is "${projectKey}" but EXPECTED_PROJECT_KEY is "${expected}"`);
  if (/healthcare/i.test(projectKey)) throw new Error(`Refusing to run against "${projectKey}": that project belongs to another team`);
}

export interface Args {
  dryRun: boolean;
  only?: string;
  confirm?: string;
  buildId?: string;
  count: number;
}

export function parseArgs(argv: string[]): Args {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const count = Number(get('--count') ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  return { dryRun: argv.includes('--dry-run'), only: get('--only'), confirm: get('--confirm'), buildId: get('--build-id'), count };
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

/** Loads `seed/.env.local` (wins) then `seed/.env`, validates, builds the API and confirms the remote project key. */
export async function getAdmin(): Promise<{ api: Api; env: SeedEnv; demoPassword: string }> {
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
  return { api: sdkApi(root), env, demoPassword: process.env.SEED_DEMO_PASSWORD ?? '' };
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
