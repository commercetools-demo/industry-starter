// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Developer tool: read, publish or delete a store theme through the Contentools service API.
//
//   node scripts/contentools-theme.mjs get    --store <key>
//   node scripts/contentools-theme.mjs put    --store <key> --file <path.json>
//   node scripts/contentools-theme.mjs delete --store <key>
//
// `put` and `delete` accept only the `default` namespace and `qa-*` stores (never a real reseller). Writes need the
// Contentools JWT, which the Merchant Center app stores in the project's custom object
// contentools-configuration / contentools-jwt-token; it is read with the seed API client from ../seed/.env.local.
// Nothing secret is ever printed: not the token, not the client secret, not a header.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STORE_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;
const WRITABLE_STORE = /^(default|qa-[A-Za-z0-9_-]+)$/;
export const EXIT = { ok: 0, failed: 1, notReady: 2, usage: 64 };

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function readEnv(file) {
  return existsSync(file) ? parseEnvFile(readFileSync(file, 'utf8')) : {};
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i].startsWith('--')) {
      flags[rest[i].slice(2)] = rest[i + 1];
      i += 1;
    }
  }
  return { command, store: flags.store, file: flags.file };
}

function jwtExpiry(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function readJwt(config, fetchImpl) {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const tokenResponse = await fetchImpl(`${config.authUrl.replace(/\/+$/, '')}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tokenResponse.ok) throw new Stop(EXIT.failed, `commercetools authentication failed (${tokenResponse.status})`);
  const { access_token: accessToken } = await tokenResponse.json();
  const objectResponse = await fetchImpl(`${config.apiUrl.replace(/\/+$/, '')}/${config.projectKey}/custom-objects/contentools-configuration/contentools-jwt-token`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (objectResponse.status === 404) throw new Stop(EXIT.notReady, 'Contentools is not connected (OA-02)');
  if (!objectResponse.ok) throw new Stop(EXIT.failed, `reading the Contentools token failed (${objectResponse.status})`);
  const { value } = await objectResponse.json();
  if (typeof value !== 'string' || value.length === 0) throw new Stop(EXIT.notReady, 'Contentools is not connected (OA-02)');
  const expires = jwtExpiry(value);
  if (expires !== null && expires <= Date.now()) throw new Stop(EXIT.notReady, 'Token expired: open the Contentools Merchant Center app once');
  return value;
}

/**
 * Runs the tool. `io` is injectable for tests: { stdout, stderr, fetch, seedEnvFile, localEnvFile }.
 * Returns the process exit code.
 */
export async function run(argv, io = {}) {
  const stdout = io.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const stderr = io.stderr ?? ((s) => process.stderr.write(`${s}\n`));
  const fetchImpl = io.fetch ?? fetch;
  const seedEnv = io.seedEnvFile ?? path.resolve(import.meta.dirname, '../../seed/.env.local');
  const localEnv = io.localEnvFile ?? path.resolve(import.meta.dirname, '../.env.local');
  try {
    const { command, store, file } = parseArgs(argv);
    if (!['get', 'put', 'delete'].includes(command) || !store || !STORE_PATTERN.test(store)) {
      throw new Stop(EXIT.usage, 'usage: contentools-theme.mjs get|put|delete --store <key> [--file <path.json>]');
    }
    if (command !== 'get' && !WRITABLE_STORE.test(store)) {
      throw new Stop(EXIT.usage, `refusing to ${command} store "${store}": only "default" and "qa-*" stores are allowed`);
    }
    if (command === 'put' && !file) throw new Stop(EXIT.usage, 'put needs --file <path.json>');

    const env = { ...readEnv(localEnv), ...readEnv(seedEnv) };
    const origin = (env.CONTENTOOLS_ORIGIN ?? '').replace(/\/+$/, '');
    if (!origin) throw new Stop(EXIT.failed, 'CONTENTOOLS_ORIGIN is not set in .env.local');
    const projectKey = env.SEED_CTP_PROJECT_KEY ?? env.CTP_PROJECT_KEY ?? '';
    if (!projectKey) throw new Stop(EXIT.failed, 'SEED_CTP_PROJECT_KEY is not set in ../seed/.env.local');
    const themeUrl = `${origin}/service/${encodeURIComponent(store)}/configuration/theme`;

    if (command === 'get') {
      const response = await fetchImpl(themeUrl, { headers: { 'x-project-key': projectKey } });
      stdout(await response.text());
      return response.ok ? EXIT.ok : EXIT.failed;
    }

    let value;
    if (command === 'put') {
      try {
        value = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
      } catch {
        throw new Stop(EXIT.usage, `cannot read a JSON object from ${file}`);
      }
    }
    const config = {
      authUrl: env.SEED_CTP_AUTH_URL ?? '',
      apiUrl: env.SEED_CTP_API_URL ?? '',
      clientId: env.SEED_CTP_CLIENT_ID ?? '',
      clientSecret: env.SEED_CTP_CLIENT_SECRET ?? '',
      projectKey,
    };
    if (!config.authUrl || !config.apiUrl || !config.clientId || !config.clientSecret) {
      throw new Stop(EXIT.failed, 'the SEED_CTP_* variables are not all set in ../seed/.env.local');
    }
    const jwt = await readJwt(config, fetchImpl);
    const headers = { Authorization: `Bearer ${jwt}`, 'x-project-key': projectKey, 'Content-Type': 'application/json' };

    if (command === 'delete') {
      const response = await fetchImpl(themeUrl, { method: 'DELETE', headers });
      stdout(`delete ${store}: ${response.status}`);
      return response.ok ? EXIT.ok : EXIT.failed;
    }

    const body = JSON.stringify({ value });
    let response = await fetchImpl(themeUrl, { method: 'POST', headers, body });
    // The real service upserts on POST; the fallback covers a service that answers "already exists".
    if (response.status === 409 || response.status === 400) response = await fetchImpl(themeUrl, { method: 'PUT', headers, body });
    stdout(`put ${store}: ${response.status}`);
    return response.ok ? EXIT.ok : EXIT.failed;
  } catch (error) {
    if (error instanceof Stop) {
      stderr(error.message);
      return error.code;
    }
    stderr(`failed: ${error instanceof Error ? error.name : 'error'}`);
    return EXIT.failed;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
