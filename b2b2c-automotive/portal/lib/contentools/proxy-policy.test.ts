// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateProxyRequest, strictStore } from './proxy-policy';

const S = 'mau-reseller-north';
const OTHER = 'mau-reseller-south';
const run = (method: string, rawPath: string, extra: { query?: string; bodyJson?: unknown } = {}) => evaluateProxyRequest({ method, rawPath, sessionStoreKey: S, ...extra });

const ALL = ['GET', 'POST', 'PUT', 'DELETE'];
const READ_POST = ['GET', 'POST'];
const KINDS = ['puck-pages', 'puck-contents'];

const allowedRows: [string, string[]][] = [
  [`service/${S}/configuration/theme`, ALL],
  ...KINDS.flatMap((k): [string, string[]][] => [
    [`service/${S}/${k}`, ALL],
    [`service/${S}/${k}/abc-123_x.y~z`, ALL],
    [`service/${S}/${k}/abc/states`, ALL],
    [`service/${S}/${k}/abc/states/published`, ALL],
    [`service/${S}/${k}/abc/states/draft`, ALL],
    [`service/${S}/${k}/abc/versions`, ALL],
    [`service/${S}/published/${k}/abc`, READ_POST],
    [`service/${S}/preview/${k}/abc`, READ_POST],
    [`service/${S}/published/${k}/query`, READ_POST],
    [`service/${S}/preview/${k}/query`, READ_POST],
  ]),
  [`service/${S}/puck-templates`, ALL],
  [`service/${S}/puck-templates/tpl-1`, ALL],
  [`service/${S}/upload-file`, ['POST']],
  [`service/${S}/media-library`, ['GET']],
  ['service/products/search', READ_POST],
];

describe('allow-list rows (section 7)', () => {
  for (const [path, methods] of allowedRows) {
    for (const method of ALL) {
      const allowed = methods.includes(method);
      it(`${method} ${path} is ${allowed ? 'allowed' : '405'}`, () => {
        const result = run(method, path);
        if (allowed) expect(result).toMatchObject({ ok: true, upstreamPath: path });
        else expect(result).toMatchObject({ ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' });
      });
    }
  }

  it('HEAD is treated as GET', () => {
    expect(run('HEAD', `service/${S}/configuration/theme`)).toMatchObject({ ok: true, write: false, needsJwt: false });
  });

  it('writes need the JWT, reads and read-only query POSTs do not', () => {
    expect(run('PUT', `service/${S}/configuration/theme`)).toMatchObject({ ok: true, write: true, needsJwt: true });
    expect(run('GET', `service/${S}/configuration/theme`)).toMatchObject({ needsJwt: false });
    expect(run('POST', `service/${S}/published/puck-pages/query`)).toMatchObject({ write: true, needsJwt: false });
    expect(run('POST', 'service/products/search')).toMatchObject({ write: true, needsJwt: false });
  });

  it('only upload-file takes multipart', () => {
    expect(run('POST', `service/${S}/upload-file`)).toMatchObject({ multipart: true });
    expect(run('POST', `service/${S}/puck-pages`)).toMatchObject({ multipart: false });
  });
});

describe('everything else is 404', () => {
  it.each([
    'service/refresh-jwt',
    'service/authenticate-project',
    'service/health',
    `service/${S}/configuration`,
    `service/${S}/configurations`,
    `service/${S}/configuration/header`,
    `service/${S}/configuration/footer`,
    `service/${S}/proxy-script`,
    `service/${S}/puck-pages/abc/other`,
    `service/${S}/puck-pages/abc/states/other`,
    'other/x',
    'configuration/theme',
  ])('%s', (path) => {
    expect(run('GET', path)).toMatchObject({ ok: false, status: 404, code: 'NOT_FOUND' });
    expect(run('POST', path)).toMatchObject({ ok: false, status: 404 });
  });

  it('a key with a character outside the key pattern is 404', () => {
    expect(run('GET', `service/${S}/puck-pages/abc$def`)).toMatchObject({ ok: false, status: 404 });
  });
});

describe('path hygiene (400 INVALID_PATH)', () => {
  it.each([
    ['dot dot', `service/${S}/puck-pages/../configuration/theme`],
    ['encoded slash', `service/${S}/puck-pages/a%2fb`],
    ['upper case encoded slash', `service/${S}/puck-pages/a%2Fb`],
    ['encoded backslash', `service/${S}/puck-pages/a%5cb`],
    ['double encoding', `service/${S}/puck-pages/%252e%252e`],
    ['encoded dot dot', `service/${S}/%2e%2e/configuration/theme`],
    ['NUL', `service/${S}/puck-pages/a\u0000b`],
    ['encoded NUL', `service/${S}/puck-pages/a%00b`],
    ['tab', `service/${S}/puck-pages/a\tb`],
    ['backslash', `service/${S}\\puck-pages`],
    ['empty segment', `service/${S}//puck-pages`],
    ['double slash', 'service//x'],
    ['trailing slash', `service/${S}/puck-pages/`],
    ['empty', ''],
    ['dot segment', `service/${S}/puck-pages/.`],
  ])('%s', (_name, path) => {
    expect(run('GET', path)).toMatchObject({ ok: false, status: 400, code: 'INVALID_PATH' });
  });

  it('a space is refused too', () => {
    expect(run('GET', `service/${S}/puck-pages/a b`)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('methods outside the allow-list', () => {
  it.each(['TRACE', 'CONNECT', 'OPTIONS', 'PROPFIND'])('%s is 405', (method) => {
    expect(run(method, `service/${S}/configuration/theme`)).toMatchObject({ ok: false, status: 405, code: 'METHOD_NOT_ALLOWED' });
  });

  it('PATCH is 405 on every allow-listed route', () => {
    expect(run('PATCH', `service/${S}/configuration/theme`)).toMatchObject({ ok: false, status: 405 });
  });
});

describe('store check (403 PROXY_STORE_MISMATCH)', () => {
  it('another store in the path is refused', () => {
    expect(run('PUT', `service/${OTHER}/configuration/theme`)).toEqual({ ok: false, status: 403, code: 'PROXY_STORE_MISMATCH' });
    expect(run('GET', `service/${OTHER}/puck-pages`)).toMatchObject({ ok: false, status: 403 });
  });

  it('a store only in the query is refused', () => {
    expect(run('GET', `service/${S}/puck-pages`, { query: `?businessUnitKey=${OTHER}` })).toMatchObject({ ok: false, status: 403, code: 'PROXY_STORE_MISMATCH' });
    expect(run('GET', `service/${S}/puck-pages`, { query: `storeKey=${OTHER}` })).toMatchObject({ ok: false, status: 403 });
  });

  it('a store only in the JSON body is refused, also when nested', () => {
    expect(run('POST', `service/${S}/puck-pages`, { bodyJson: { value: { businessUnitKey: OTHER } } })).toMatchObject({ ok: false, status: 403 });
    expect(run('PUT', `service/${S}/configuration/theme`, { bodyJson: { items: [{ nested: { storeKey: OTHER } }] } })).toMatchObject({ ok: false, status: 403 });
  });

  it('the session store in query and body passes', () => {
    expect(run('POST', `service/${S}/puck-pages`, { query: `?businessUnitKey=${S}&x=1`, bodyJson: { storeKey: S, value: {} } })).toMatchObject({ ok: true, upstreamSearch: `?businessUnitKey=${S}&x=1` });
  });

  it('service/products/search has no store segment but its query is still checked', () => {
    expect(run('GET', 'service/products/search', { query: '?q=brake' })).toMatchObject({ ok: true, upstreamPath: 'service/products/search' });
    expect(run('GET', 'service/products/search', { query: `?storeKey=${OTHER}` })).toMatchObject({ ok: false, status: 403 });
  });

  it('no store segment at all is not a way around the check', () => {
    expect(run('PUT', 'service/configuration/theme')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('PROXY_STRICT_STORE=false', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rewrites the path segment and the query outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PROXY_STRICT_STORE', 'false');
    expect(strictStore()).toBe(false);
    expect(run('PUT', `service/${OTHER}/configuration/theme`)).toMatchObject({ ok: true, upstreamPath: `service/${S}/configuration/theme` });
    expect(run('GET', `service/${S}/puck-pages`, { query: `?businessUnitKey=${OTHER}` })).toMatchObject({ ok: true, upstreamSearch: `?businessUnitKey=${S}` });
  });

  it('a mismatching body is still refused', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PROXY_STRICT_STORE', 'false');
    expect(run('POST', `service/${S}/puck-pages`, { bodyJson: { businessUnitKey: OTHER } })).toMatchObject({ ok: false, status: 403 });
  });

  it('is ignored in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PROXY_STRICT_STORE', 'false');
    expect(strictStore()).toBe(true);
    expect(run('PUT', `service/${OTHER}/configuration/theme`)).toMatchObject({ ok: false, status: 403 });
  });

  it('strict is the default', () => {
    expect(strictStore({} as NodeJS.ProcessEnv)).toBe(true);
    expect(strictStore({ NODE_ENV: 'development', PROXY_STRICT_STORE: 'true' })).toBe(true);
  });
});
