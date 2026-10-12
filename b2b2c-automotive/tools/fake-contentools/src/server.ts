// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { requireProjectKey, validateJwt } from './auth.ts';
import {
  CONFIG_SLICES,
  deleteSlice,
  getAllConfigurations,
  getSlice,
  saveSlice,
  type ConfigSlice,
} from './configuration.ts';
import { HttpError, RawUpstreamError } from './errors.ts';
import { parseMultipart } from './multipart.ts';
import * as puck from './puck.ts';
import {
  defaultOptionsFromEnv,
  FAIL_MODES,
  loadFixtureFile,
  seedStore,
  type FakeOptions,
  type FakeState,
  type FailModeName,
  type Fixture,
  type LoggedRequest,
  type Override,
  type StoredFile,
} from './state.ts';
import { CustomObjectStore } from './store.ts';

// ---------------------------------------------------------------------------------------------------------------------
// Request / response model
// ---------------------------------------------------------------------------------------------------------------------

interface Ctx {
  state: FakeState;
  method: string;
  /** Path without query string and without a trailing slash. */
  path: string;
  segments: string[];
  query: URLSearchParams;
  headers: IncomingMessage['headers'];
  contentType: string;
  raw: Buffer;
  /** Express-like parsed body (`{}` when absent). Throws are mapped by the caller (see `parseBody`). */
  body: Record<string, unknown>;
  bodyError: Error | null;
  params: Record<string, string>;
  /** Project key resolved by the auth step (header for reads, `sub` claim for writes). */
  projectKey: string;
  baseUrl: string;
}

interface Reply {
  status: number;
  /** JSON body (serialised), `undefined` for an empty body. */
  json?: unknown;
  hasJson?: boolean;
  headers?: Record<string, string>;
  raw?: Buffer;
  contentType?: string;
}

const json = (status: number, body: unknown): Reply => ({ status, json: body, hasJson: true });
const empty = (status: number): Reply => ({ status });

type AuthKind = 'project' | 'jwt' | 'jwt-ignore-expiry' | 'none';
interface Route {
  method: string;
  segments: string[];
  auth: AuthKind;
  handler: (c: Ctx) => Reply;
}

// ---------------------------------------------------------------------------------------------------------------------
// Routes (mounted under /service, exactly like the real service)
// ---------------------------------------------------------------------------------------------------------------------

const routes: Route[] = [];
function add(method: string, pattern: string, auth: AuthKind, handler: (c: Ctx) => Reply): void {
  routes.push({ method, segments: pattern.split('/').filter(Boolean), auth, handler });
}

const requireValue = (c: Ctx): Record<string, unknown> => {
  const { value } = c.body;
  if (!value) throw new HttpError(400, 'value is required in request body');
  return value as Record<string, unknown>;
};

// Configuration: theme first (the only slice the storefront reads), then the other slices with the same behaviour.
for (const slice of Object.keys(CONFIG_SLICES) as ConfigSlice[]) {
  const base = `:bu/configuration/${slice}`;
  add('GET', base, 'project', (c) => json(200, getSlice(c.state.store, c.params.bu as string, slice)));
  add('POST', base, 'jwt', (c) => json(201, saveSlice(c.state.store, c.params.bu as string, slice, c.body.value)));
  add('PUT', base, 'jwt', (c) => json(200, saveSlice(c.state.store, c.params.bu as string, slice, c.body.value)));
  add('DELETE', base, 'jwt', (c) => {
    deleteSlice(c.state.store, c.params.bu as string, slice);
    return empty(204);
  });
}
add('GET', ':bu/configuration', 'project', (c) => json(200, getAllConfigurations(c.state.store, c.params.bu as string)));
add('GET', ':bu/configurations', 'project', (c) => json(200, getAllConfigurations(c.state.store, c.params.bu as string)));

// Puck pages and Puck contents.
for (const [segment, kind] of [
  ['puck-pages', puck.PAGE_KIND],
  ['puck-contents', puck.CONTENT_KIND],
] as const) {
  const isContent = kind.name === 'content';
  add('GET', `:bu/${segment}`, 'project', (c) =>
    json(200, puck.list(c.state.store, kind, c.params.bu as string, isContent ? (c.query.get('contentType') ?? undefined) : undefined)),
  );
  add('GET', `:bu/${segment}/:key`, 'project', (c) => json(200, puck.getWithStates(c.state.store, kind, c.params.bu as string, c.params.key as string)));
  add('POST', `:bu/${segment}`, 'jwt', (c) => json(201, puck.create(c.state.store, kind, c.params.bu as string, requireValue(c))));
  add('PUT', `:bu/${segment}/:key`, 'jwt', (c) =>
    json(200, puck.update(c.state.store, kind, c.params.bu as string, c.params.key as string, requireValue(c))),
  );
  add('DELETE', `:bu/${segment}/:key`, 'jwt', (c) => {
    puck.remove(c.state.store, kind, c.params.bu as string, c.params.key as string);
    return empty(204);
  });
  add('GET', `:bu/published/${segment}/:key`, 'project', (c) =>
    json(200, puck.getPublished(c.state.store, kind, c.params.bu as string, c.params.key as string)),
  );
  add('GET', `:bu/preview/${segment}/:key`, 'project', (c) =>
    json(200, puck.getPreview(c.state.store, kind, c.params.bu as string, c.params.key as string)),
  );
  add('POST', `:bu/published/${segment}/query`, 'project', (c) =>
    json(200, puck.query(c.state.store, kind, c.params.bu as string, c.body.query, ['published'])),
  );
  add('POST', `:bu/preview/${segment}/query`, 'project', (c) =>
    json(200, puck.query(c.state.store, kind, c.params.bu as string, c.body.query, ['draft', 'published'])),
  );
  add('GET', `:bu/${segment}/:key/states`, 'project', (c) => json(200, puck.getStates(c.state.store, kind, c.params.bu as string, c.params.key as string)));
  add('PUT', `:bu/${segment}/:key/states/published`, 'jwt', (c) =>
    json(200, puck.publish(c.state.store, kind, c.params.bu as string, c.params.key as string, c.query.get('clearDraft') === 'true')),
  );
  add('DELETE', `:bu/${segment}/:key/states/draft`, 'jwt', (c) =>
    json(200, puck.revertDraft(c.state.store, kind, c.params.bu as string, c.params.key as string)),
  );
  add('GET', `:bu/${segment}/:key/versions`, 'project', (c) => json(200, puck.getVersions(c.state.store, kind, c.params.bu as string, c.params.key as string)));
}

// Upload (multipart, field `file`, optional `title` and `description`) and media library.
add('POST', ':bu/upload-file', 'jwt', (c) => {
  const parsed = c.contentType.toLowerCase().startsWith('multipart/form-data') ? parseMultipart(c.raw, c.contentType) : null;
  // multer `upload.single('file')` rejects a file under another field name ("Unexpected field"): not a CustomError, so 500.
  if (parsed?.files.some((f) => f.fieldname !== 'file')) throw new RawUpstreamError('Unexpected field');
  const file = parsed?.files[0];
  if (!file) return json(400, { error: 'No file uploaded' });
  const bu = c.params.bu as string;
  const storagePath = `${c.projectKey}/${bu}`;
  const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.') || 'file';
  const path = `${storagePath}/${randomUUID().slice(0, 8)}-${safe}`;
  const stored: StoredFile = {
    path,
    name: file.originalname,
    mimetype: file.mimetype,
    buffer: file.buffer,
    title: parsed?.fields.title ?? '',
    description: parsed?.fields.description ?? '',
    createdAt: new Date().toISOString(),
  };
  c.state.files.set(path, stored);
  return json(200, { url: `${c.baseUrl}/__files/${path.split('/').map(encodeURIComponent).join('/')}` });
});

add('GET', ':bu/media-library', 'project', (c) => {
  const prefix = `${c.projectKey}/${c.params.bu}/`;
  const extensions = c.query.get('extensions') ? String(c.query.get('extensions')).split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()) : [];
  const page = parseInt(c.query.get('page') ?? '', 10) || 1;
  const limit = parseInt(c.query.get('limit') ?? '', 10) || 20;
  const all = [...c.state.files.values()]
    .filter((f) => f.path.startsWith(prefix))
    .filter((f) => extensions.length === 0 || extensions.includes((f.name.split('.').pop() ?? '').toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const slice = all.slice((page - 1) * limit, page * limit);
  return json(200, {
    files: slice.map((f) => ({
      url: `${c.baseUrl}/__files/${f.path.split('/').map(encodeURIComponent).join('/')}`,
      name: f.name,
      title: f.title,
      description: f.description,
      isImage: f.mimetype.startsWith('image/'),
      createdAt: f.createdAt,
      size: f.buffer.length,
    })),
    pagination: { totalItems: all.length, totalPages: Math.ceil(all.length / limit), currentPage: page, limit },
  });
});

// Auth helpers the portal's JWT resolution may probe.
add('GET', 'health', 'project', () => json(200, { status: 'healthy', timestamp: new Date().toISOString(), service: 'multitenant-contentools' }));
add('POST', 'refresh-jwt', 'jwt-ignore-expiry', (c) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: c.projectKey, iss: 'multitenant-contentools', aud: 'multitenant-contentools', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return json(200, { token: `${header}.${payload}.fake-signature`, expiresIn: '1h', projectKey: c.projectKey });
});

function matchRoute(method: string, segments: string[]): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const pat = route.segments[i] as string;
      const seg = segments[i] as string;
      if (pat.startsWith(':')) params[pat.slice(1)] = seg;
      else if (pat.toLowerCase() !== seg.toLowerCase()) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Failure injection, overrides, admin
// ---------------------------------------------------------------------------------------------------------------------

const THEME_GET = /^\/service\/[^/]+\/configuration\/theme$/i;

type FailOutcome = { kind: 'continue' } | { kind: 'reply'; reply: Reply } | { kind: 'drop' };

async function applyFail(state: FakeState, c: Pick<Ctx, 'method' | 'path'>): Promise<{ outcome: FailOutcome; mode: FailModeName }> {
  const fail = state.options.fail;
  const mode = fail.mode;
  if (mode === 'none') return { outcome: { kind: 'continue' }, mode };
  const themeOnly = mode.startsWith('theme-');
  if (themeOnly && !(c.method === 'GET' && THEME_GET.test(c.path))) return { outcome: { kind: 'continue' }, mode };

  if (fail.times !== null) {
    fail.times -= 1;
    if (fail.times <= 0) {
      fail.mode = 'none';
      fail.times = null;
    }
  }
  const base = themeOnly ? mode.slice('theme-'.length) : mode;
  if (base === 'slow') {
    await new Promise((r) => setTimeout(r, fail.delayMs));
    return { outcome: { kind: 'continue' }, mode };
  }
  if (base === 'drop') return { outcome: { kind: 'drop' }, mode };
  if (base === 'down') return { outcome: { kind: 'reply', reply: json(503, { message: 'Service Unavailable' }) }, mode };
  return { outcome: { kind: 'reply', reply: json(fail.status, { message: 'Internal server error' }) }, mode };
}

function matchOverride(state: FakeState, c: Ctx): Override | null {
  for (const o of state.overrides) {
    if (o.method && o.method.toUpperCase() !== c.method) continue;
    const full = c.path + (c.query.size ? `?${c.query.toString()}` : '');
    if (o.pathPrefix && !c.path.startsWith(o.pathPrefix)) continue;
    if (o.pathRegex && !new RegExp(o.pathRegex).test(full)) continue;
    if (!o.pathPrefix && !o.pathRegex) continue;
    if (o.times !== null) {
      o.times -= 1;
      if (o.times <= 0) state.overrides = state.overrides.filter((x) => x.id !== o.id);
    }
    return o;
  }
  return null;
}

function parseBody(c: Pick<Ctx, 'raw' | 'contentType'>, limit: number): { body: Record<string, unknown>; error: Error | null } {
  const type = c.contentType.toLowerCase();
  if (c.raw.length === 0) return { body: {}, error: null };
  if (type.startsWith('application/json')) {
    // body-parser: `limit` default 100kb -> 413, malformed or non-object JSON (strict) -> 400. Both reach the error
    // middleware as non-CustomErrors, i.e. 500.
    if (c.raw.length > limit) return { body: {}, error: new RawUpstreamError('request entity too large') };
    try {
      const parsed: unknown = JSON.parse(c.raw.toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null) throw new Error('strict mode');
      return { body: parsed as Record<string, unknown>, error: null };
    } catch {
      return { body: {}, error: new RawUpstreamError('invalid json') };
    }
  }
  if (type.startsWith('application/x-www-form-urlencoded')) {
    return { body: Object.fromEntries(new URLSearchParams(c.raw.toString('utf8'))), error: null };
  }
  return { body: {}, error: null };
}

const send = (res: ServerResponse, reply: Reply, extra: Record<string, string> = {}): void => {
  const headers: Record<string, string> = { ...extra, ...reply.headers };
  if (reply.raw) {
    res.writeHead(reply.status, { 'Content-Type': reply.contentType ?? 'application/octet-stream', 'Content-Length': String(reply.raw.length), ...headers });
    res.end(reply.raw);
    return;
  }
  if (reply.hasJson) {
    const text = JSON.stringify(reply.json) ?? 'null';
    res.writeHead(reply.status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(text)), ...headers });
    res.end(text);
    return;
  }
  res.writeHead(reply.status, headers);
  res.end();
};

const errorReply = (error: unknown): Reply =>
  error instanceof HttpError
    ? json(error.statusCode, { message: error.message, errors: error.errors })
    : json(500, { message: 'Internal server error' });

function adminReply(state: FakeState, method: string, path: string, query: URLSearchParams, body: Record<string, unknown>, bodyError: Error | null, reset: () => void): Reply | null {
  const p = path;
  if (p === '/__admin/requests' || p === '/__log') {
    if (method === 'GET') {
      const since = Number(query.get('since') ?? 0);
      const m = query.get('method')?.toUpperCase();
      const sub = query.get('path');
      const prefix = query.get('pathPrefix');
      const list = state.log.filter((r) => r.id > since && (!m || r.method === m) && (!sub || r.path.includes(sub)) && (!prefix || r.path.startsWith(prefix)));
      return json(200, list);
    }
    if (method === 'DELETE') {
      state.log.length = 0;
      return empty(204);
    }
  }
  if (p === '/__admin/fail') {
    if (method === 'GET') return json(200, state.options.fail);
    if (method === 'DELETE') {
      state.options.fail = { mode: 'none', delayMs: state.options.fail.delayMs, status: 500, times: null };
      return json(200, state.options.fail);
    }
    if (method === 'POST') {
      if (bodyError) return json(400, { message: 'invalid json' });
      const mode = body.mode as FailModeName;
      if (!FAIL_MODES.includes(mode)) return json(400, { message: `mode must be one of ${FAIL_MODES.join(', ')}` });
      state.options.fail = {
        mode,
        delayMs: typeof body.delayMs === 'number' ? body.delayMs : state.options.fail.delayMs,
        status: typeof body.status === 'number' ? body.status : 500,
        times: typeof body.times === 'number' ? body.times : null,
      };
      return json(200, state.options.fail);
    }
  }
  if (p === '/__admin/overrides') {
    if (method === 'GET') return json(200, state.overrides);
    if (method === 'DELETE') {
      state.overrides = [];
      return empty(204);
    }
    if (method === 'POST') {
      if (bodyError || typeof body.status !== 'number') return json(400, { message: 'status (number) is required' });
      const o: Override = {
        id: state.nextOverrideId++,
        status: body.status,
        times: typeof body.times === 'number' ? body.times : null,
        ...(typeof body.method === 'string' ? { method: body.method } : {}),
        ...(typeof body.pathPrefix === 'string' ? { pathPrefix: body.pathPrefix } : {}),
        ...(typeof body.pathRegex === 'string' ? { pathRegex: body.pathRegex } : {}),
        ...(body.headers && typeof body.headers === 'object' ? { headers: body.headers as Record<string, string> } : {}),
        ...('body' in body ? { body: body.body } : {}),
        ...(body.echoRequestHeaders ? { echoRequestHeaders: true } : {}),
      };
      state.overrides.push(o);
      return json(201, o);
    }
  }
  if (p === '/__admin/reset' && method === 'POST') {
    reset();
    return json(200, { ok: true });
  }
  if (p === '/__admin/health' && method === 'GET') return json(200, { status: 'ok' });
  if (p === '/__admin/state' && method === 'GET') {
    const objects: Record<string, string[]> = {};
    for (const container of ['configuration', 'puck-page', 'puck-page-state', 'puck-page-version', 'puck-content', 'puck-content-state', 'puck-content-version']) {
      objects[container] = state.store.list(container).map((o) => o.key);
    }
    return json(200, { objects, files: [...state.files.keys()], fail: state.options.fail, overrides: state.overrides.length, requests: state.log.length });
  }
  return p.startsWith('/__admin/') ? json(404, { message: 'Unknown admin route' }) : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------------------------------------------------

export interface FakeContentools {
  server: Server;
  state: FakeState;
  /** Base URL, e.g. `http://127.0.0.1:4010`. */
  url: string;
  port: number;
  /** Reload the fixture and clear request log, overrides, uploads and failure mode back to the start options. */
  reset(fixture?: Fixture): void;
  /** Bind the configured host and port (port 0 picks a free one; read it back from `port` or `url`). */
  listen(): Promise<void>;
  close(): Promise<void>;
}

export function createState(options: FakeOptions, fixture?: Fixture): FakeState {
  const state: FakeState = {
    options: { ...options, fail: { ...options.fail } },
    store: new CustomObjectStore(),
    files: new Map(),
    log: [],
    overrides: [],
    nextLogId: 1,
    nextOverrideId: 1,
    fixture: fixture ?? loadFixtureFile(options.fixturePath),
  };
  seedStore(state.store, state.fixture);
  return state;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function bodyForLog(raw: Buffer, contentType: string): unknown {
  if (raw.length === 0) return undefined;
  const type = contentType.toLowerCase();
  if (type.startsWith('multipart/')) {
    const parsed = parseMultipart(raw, contentType);
    return { multipart: true, bytes: raw.length, files: parsed?.files.map((f) => ({ field: f.fieldname, name: f.originalname, type: f.mimetype, size: f.size })) ?? [] };
  }
  const text = raw.subarray(0, 64 * 1024).toString('utf8');
  if (type.startsWith('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

export function createFakeContentools(options: FakeOptions = defaultOptionsFromEnv(), fixture?: Fixture): FakeContentools {
  const state = createState(options, fixture);
  const initial = { fail: { ...options.fail } };
  let boundPort = options.port;

  const reset = (next?: Fixture): void => {
    state.store.clear();
    state.files.clear();
    state.log.length = 0;
    state.overrides = [];
    state.options.fail = { ...initial.fail };
    state.fixture = next ?? loadFixtureFile(state.options.fixturePath);
    seedStore(state.store, state.fixture);
  };

  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) send(res, json(500, { message: 'Internal server error' }));
      else res.end();
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = new URL(req.url ?? '/', 'http://fake-contentools.local');
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    const contentType = String(req.headers['content-type'] ?? '');
    const raw = await readBody(req);
    const baseUrl = state.options.publicBaseUrl ?? `http://localhost:${boundPort}`;

    const isAdmin = path.startsWith('/__admin/') || path === '/__log';
    let entry: LoggedRequest | null = null;
    if (!isAdmin) {
      entry = {
        id: state.nextLogId++,
        at: new Date().toISOString(),
        method,
        url: req.url ?? '/',
        path,
        headers: { ...req.headers },
        body: bodyForLog(raw, contentType),
        status: null,
        handledBy: 'pending',
      };
      state.log.push(entry);
      if (state.log.length > state.options.logLimit) state.log.splice(0, state.log.length - state.options.logLimit);
      const logged = entry;
      res.on('finish', () => {
        logged.status = res.statusCode;
      });
    }

    const parsed = parseBody({ raw, contentType }, state.options.jsonLimitBytes);
    const origin = req.headers.origin;
    const cors: Record<string, string> = {};
    if (typeof origin === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cors['Access-Control-Allow-Origin'] = origin;
      cors.Vary = 'Origin';
    }

    if (isAdmin) {
      const reply = adminReply(state, method, path, url.searchParams, parsed.body, parsed.error, () => reset());
      send(res, reply ?? json(404, { message: 'Path not found.' }));
      return;
    }

    if (method === 'OPTIONS' && cors['Access-Control-Allow-Origin']) {
      if (entry) entry.handledBy = 'cors-preflight';
      send(res, empty(204), { ...cors, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-project-key,x-source' });
      return;
    }

    const base: Ctx = {
      state,
      method,
      path,
      segments: [],
      query: url.searchParams,
      headers: req.headers,
      contentType,
      raw,
      body: parsed.body,
      bodyError: parsed.error,
      params: {},
      projectKey: '',
      baseUrl,
    };

    // 1. failure injection
    const failed = await applyFail(state, base);
    if (failed.outcome.kind === 'drop') {
      if (entry) entry.handledBy = `fail:${failed.mode}`;
      req.socket.destroy();
      return;
    }
    if (failed.outcome.kind === 'reply') {
      if (entry) entry.handledBy = `fail:${failed.mode}`;
      send(res, failed.outcome.reply, cors);
      return;
    }

    // 2. scripted overrides
    const override = matchOverride(state, base);
    if (override) {
      if (entry) entry.handledBy = 'override';
      let body: unknown = override.body;
      if (override.echoRequestHeaders) body = { ...(typeof body === 'object' && body !== null ? body : {}), receivedHeaders: req.headers };
      const reply: Reply = typeof body === 'string' ? { status: override.status, raw: Buffer.from(body), contentType: 'text/plain; charset=utf-8' } : body === undefined ? empty(override.status) : json(override.status, body);
      send(res, { ...reply, headers: override.headers }, cors);
      return;
    }

    // 3. record-only stub
    if (state.options.stubMode) {
      if (entry) entry.handledBy = 'stub';
      send(res, json(200, { ok: true, stub: true }), cors);
      return;
    }

    // 4. uploaded files (public, like a bucket URL)
    if (method === 'GET' && path.startsWith('/__files/')) {
      if (entry) entry.handledBy = 'route';
      const stored = state.files.get(path.slice('/__files/'.length).split('/').map(decodeURIComponent).join('/'));
      send(res, stored ? { status: 200, raw: stored.buffer, contentType: stored.mimetype, headers: { 'X-Content-Type-Options': 'nosniff' } } : json(404, { message: 'File not found' }), cors);
      return;
    }

    // 5. routing
    try {
      if (parsed.error) throw parsed.error; // body-parser runs before routing in the real service
      const segments = path.split('/').filter(Boolean);
      if (segments[0]?.toLowerCase() !== 'service') throw new HttpError(404, 'Path not found.');
      const rest = segments.slice(1).map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          throw new RawUpstreamError('Failed to decode param');
        }
      });
      const hit = matchRoute(method, rest);
      if (!hit) throw new HttpError(404, 'Path not found.');
      const ctx: Ctx = { ...base, segments: rest, params: hit.params };
      if (hit.route.auth === 'project') ctx.projectKey = requireProjectKey(state.options, req.headers);
      else if (hit.route.auth === 'jwt') ctx.projectKey = validateJwt(state.options, req.headers);
      else if (hit.route.auth === 'jwt-ignore-expiry') ctx.projectKey = validateJwt(state.options, req.headers, true);
      if (entry) entry.handledBy = 'route';
      send(res, hit.route.handler(ctx), cors);
    } catch (error) {
      if (entry) entry.handledBy = 'route';
      send(res, errorReply(error), cors);
    }
  }

  const fake: FakeContentools = {
    server,
    state,
    get url() {
      return `http://${options.host}:${boundPort}`;
    },
    get port() {
      return boundPort;
    },
    reset,
    listen: () =>
      new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, options.host, () => {
          boundPort = (server.address() as AddressInfo).port;
          resolve();
        });
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
  return fake;
}

export async function startFakeContentools(options: Partial<FakeOptions> = {}, fixture?: Fixture): Promise<FakeContentools> {
  const fake = createFakeContentools({ ...defaultOptionsFromEnv({}), ...options }, fixture);
  await fake.listen();
  return fake;
}
