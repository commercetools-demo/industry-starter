// Shared helper of the live catalog scripts (workstream T). Reads the admin client from `portal/.env.local` (never printed), refuses a
// store key that is not seeded unless `--allow-any` is given, and offers a tiny REST wrapper. Nothing here runs in `npm run check`.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const SEEDED_STORES = { 'mau-reseller-north': 'mau-sel-north', 'mau-reseller-south': 'mau-sel-south' };
export const MASTER_SELECTION = 'mau-sel-malva-master';

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Returns { storeKey, flags, rest } from argv, refusing an unseeded store key without --allow-any. */
export function readArgs(argv, { usage, needsStore = true }) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const rest = argv.filter((a) => !a.startsWith('--'));
  if (needsStore) {
    const storeKey = rest[0];
    if (!storeKey) fail(usage);
    if (!(storeKey in SEEDED_STORES) && !flags.has('--allow-any')) fail(`Refusing store "${storeKey}": it is not one of ${Object.keys(SEEDED_STORES).join(', ')}. Pass --allow-any to override.`);
    return { storeKey, flags, rest: rest.slice(1) };
  }
  return { storeKey: undefined, flags, rest };
}

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export async function connect(cwd = process.cwd()) {
  let env;
  try {
    env = parseEnv(readFileSync(path.join(cwd, '.env.local'), 'utf8'));
  } catch {
    fail('Run this from portal/ with a .env.local (see .env.example).');
  }
  const need = ['CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_ADMIN_CLIENT_ID', 'CTP_ADMIN_CLIENT_SECRET'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) fail(`Missing in .env.local: ${missing.join(', ')}`);
  const basic = Buffer.from(`${env.CTP_ADMIN_CLIENT_ID}:${env.CTP_ADMIN_CLIENT_SECRET}`).toString('base64');
  const scope = env.CTP_ADMIN_SCOPES ? `&scope=${encodeURIComponent(env.CTP_ADMIN_SCOPES)}` : '';
  // Operator script outside the app: a plain OAuth call with the admin client, never part of a build.
  // eslint-disable-next-line no-restricted-syntax
  const tokenResponse = await fetch(`${env.CTP_AUTH_URL.replace(/\/$/, '')}/oauth/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials${scope}`,
  });
  if (!tokenResponse.ok) fail(`Admin client sign-in failed (HTTP ${tokenResponse.status}).`);
  const { access_token: token } = await tokenResponse.json();
  const base = `${env.CTP_API_URL.replace(/\/$/, '')}/${env.CTP_PROJECT_KEY}`;
  async function api(method, route, body) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`${method} ${route.split('?')[0]} answered ${response.status}`);
    return data;
  }
  /** All results of a list endpoint (paged by 500). */
  async function all(route) {
    const out = [];
    for (let offset = 0; ; offset += 500) {
      const sep = route.includes('?') ? '&' : '?';
      const page = await api('GET', `${route}${sep}limit=500&offset=${offset}`);
      out.push(...page.results);
      if (page.results.length === 0 || offset + page.results.length >= (page.total ?? 0)) return out;
    }
  }
  return { api, all, projectKey: env.CTP_PROJECT_KEY };
}

/** Product ids of a selection. */
export async function selectionIds(ctp, selectionKey) {
  const rows = await ctp.all(`/product-selections/key=${encodeURIComponent(selectionKey)}/products`);
  return new Set(rows.map((r) => r.product.id));
}
