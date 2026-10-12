// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTAINERS, CustomObjectStore } from './store.ts';

export type FailModeName =
  | 'none'
  | '500'
  | 'slow'
  | 'drop'
  | 'theme-down'
  | 'theme-500'
  | 'theme-slow'
  | 'theme-drop';

export const FAIL_MODES: readonly FailModeName[] = ['none', '500', 'slow', 'drop', 'theme-down', 'theme-500', 'theme-slow', 'theme-drop'];

export interface FailState {
  mode: FailModeName;
  /** Delay for the `slow` modes. */
  delayMs: number;
  /** Status for `500` and `theme-500` (default 500) ; `theme-down` always answers 503. */
  status: number;
  /** Number of requests still affected; `null` means until reset. */
  times: number | null;
}

export type JwtMode = 'jwt' | 'lenient';

export interface FakeOptions {
  port: number;
  host: string;
  /** Origin written into upload URLs. Default `http://localhost:<port>`. */
  publicBaseUrl?: string;
  /** `jwt` (default): a three-part JWT with a `sub` claim, `exp` (if present) in the future; signature not verified. `lenient`: any non-empty bearer token. */
  jwtMode: JwtMode;
  /** Registered project keys; `'*'` accepts every key. */
  projectKeys: string[] | '*';
  inactiveProjectKeys: string[];
  /** Record every request and answer 200 `{}` to everything (X-06 style recording stub); no routing, no auth. */
  stubMode: boolean;
  fail: FailState;
  /** Path of the fixture JSON. */
  fixturePath: string;
  /** `bodyParser.json` default limit of the real service. */
  jsonLimitBytes: number;
  /** Maximum number of kept request log entries. */
  logLimit: number;
}

export interface LoggedRequest {
  id: number;
  at: string;
  method: string;
  url: string;
  path: string;
  /** All received request headers, lower-case names. */
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body, raw text (max 64 KB) or `{ multipart: true, bytes }`. */
  body: unknown;
  status: number | null;
  /** How the request was answered: `route`, `fail:<mode>`, `override`, `stub`, `dropped`. */
  handledBy: string;
}

export interface Override {
  id: number;
  method?: string;
  pathPrefix?: string;
  pathRegex?: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Put the received request headers into the JSON body under `receivedHeaders` (X D13: upstream echoes secrets). */
  echoRequestHeaders?: boolean;
  times: number | null;
}

export interface StoredFile {
  path: string;
  name: string;
  mimetype: string;
  buffer: Buffer;
  title: string;
  description: string;
  createdAt: string;
}

export interface FixturePage {
  key: string;
  businessUnitKey: string;
  name: string;
  slug: string;
  puckData: { content: unknown[]; root: { props: Record<string, unknown> }; zones?: Record<string, unknown[]> };
  meta?: Record<string, unknown>;
  /** `published` keeps only the published state, `draft` only the draft state, `both` keeps both. */
  status: 'published' | 'draft' | 'both';
}

export interface FixtureContent {
  key: string;
  businessUnitKey: string;
  name: string;
  contentType: string;
  data: Record<string, unknown>;
  meta?: Record<string, unknown>;
  status: 'published' | 'draft' | 'both';
}

export interface Fixture {
  _comment?: string;
  /** Theme per namespace (`default` is the fallback). Stored as container `configuration`, key `{namespace}-theme`. */
  themes: Record<string, Record<string, unknown>>;
  pages: FixturePage[];
  contents: FixtureContent[];
}

export interface FakeState {
  options: FakeOptions;
  store: CustomObjectStore;
  files: Map<string, StoredFile>;
  log: LoggedRequest[];
  overrides: Override[];
  nextLogId: number;
  nextOverrideId: number;
  fixture: Fixture;
}

export const DEFAULT_FIXTURE_PATH = fileURLToPath(new URL('../fixtures/contentools.json', import.meta.url));

export function loadFixtureFile(path: string): Fixture {
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

const FIXED_TIME = '2026-10-12T08:00:00.000Z';

/** Writes the fixture into the store exactly as the real controllers would have left it. */
export function seedStore(store: CustomObjectStore, fixture: Fixture): void {
  for (const [namespace, theme] of Object.entries(fixture.themes)) {
    store.upsert(CONTAINERS.configuration, `${namespace}-theme`, theme, FIXED_TIME);
  }
  const seedKind = (
    kind: { content: string; state: string; version: string },
    item: { key: string; businessUnitKey: string; status: 'published' | 'draft' | 'both' },
    value: Record<string, unknown>,
  ): void => {
    store.upsert(kind.content, item.key, value, FIXED_TIME);
    const states: Record<string, unknown> = {};
    if (item.status === 'draft' || item.status === 'both') states.draft = value;
    if (item.status === 'published' || item.status === 'both') states.published = value;
    store.upsert(kind.state, `${item.businessUnitKey}_${item.key}`, { key: item.key, businessUnitKey: item.businessUnitKey, states }, FIXED_TIME);
    store.upsert(
      kind.version,
      `${item.businessUnitKey}_${item.key}`,
      { key: item.key, businessUnitKey: item.businessUnitKey, versions: [{ ...value, id: randomUUID(), timestamp: FIXED_TIME }] },
      FIXED_TIME,
    );
  };
  for (const p of fixture.pages) {
    seedKind(
      { content: CONTAINERS.puckPage, state: CONTAINERS.puckPageState, version: CONTAINERS.puckPageVersion },
      p,
      {
        key: p.key,
        businessUnitKey: p.businessUnitKey,
        name: p.name,
        slug: p.slug,
        puckData: p.puckData,
        ...(p.meta ? { meta: p.meta } : {}),
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
    );
  }
  for (const c of fixture.contents) {
    seedKind(
      { content: CONTAINERS.puckContent, state: CONTAINERS.puckContentState, version: CONTAINERS.puckContentVersion },
      c,
      {
        key: c.key,
        businessUnitKey: c.businessUnitKey,
        name: c.name,
        contentType: c.contentType,
        data: c.data,
        ...(c.meta ? { meta: c.meta } : {}),
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
    );
  }
}

export function defaultOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): FakeOptions {
  const mode = (env.FAIL_MODE ?? 'none') as FailModeName;
  if (!FAIL_MODES.includes(mode)) throw new Error(`FAIL_MODE must be one of ${FAIL_MODES.join(', ')}`);
  const keys = env.PROJECT_KEYS?.trim();
  const jwtMode = (env.JWT_MODE ?? 'jwt') as JwtMode;
  if (jwtMode !== 'jwt' && jwtMode !== 'lenient') throw new Error('JWT_MODE must be jwt or lenient');
  return {
    port: Number(env.PORT ?? 4010),
    host: env.HOST ?? '127.0.0.1',
    ...(env.PUBLIC_BASE_URL ? { publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, '') } : {}),
    jwtMode,
    projectKeys: !keys || keys === '*' ? '*' : keys.split(',').map((k) => k.trim()).filter(Boolean),
    inactiveProjectKeys: (env.INACTIVE_PROJECT_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean),
    stubMode: env.STUB_MODE === '1' || env.STUB_MODE === 'true',
    fail: {
      mode,
      delayMs: Number(env.FAIL_DELAY_MS ?? 5000),
      status: Number(env.FAIL_STATUS ?? 500),
      times: null,
    },
    fixturePath: env.FIXTURE ?? DEFAULT_FIXTURE_PATH,
    jsonLimitBytes: Number(env.JSON_LIMIT_BYTES ?? 100 * 1024),
    logLimit: Number(env.LOG_LIMIT ?? 2000),
  };
}
