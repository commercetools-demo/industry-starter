// After `next build`: fails if a server-only variable NAME or a secret VALUE appears in the client bundle or server output,
// if a source map is emitted into .next/static, or (release builds) if a dev-only route was compiled. Values are read from
// the environment only to search for them and are never printed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_NAMES } from './check-tracked-files.mjs';

export function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function scanBundle(root) {
  const dir = join(root, '.next', 'static');
  const problems = [];
  for (const path of walk(dir)) {
    if (!/\.(js|css|html|json|map)$/.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const name of SECRET_NAMES) {
      if (text.includes(name)) problems.push(`${path.slice(root.length + 1)} contains ${name}`);
    }
  }
  return problems;
}

/** Secrets whose VALUES must not appear anywhere in the build output (read from the environment, never printed). */
export const SECRET_VALUE_NAMES = ['CTP_CLIENT_SECRET', 'SESSION_SECRET', 'AUTO_REFILL_RUN_SECRET', 'RELOAD_ALLOWANCES_SECRET', 'RETENTION_SECRET'];

/** Browser source maps would publish the source; none may be emitted into .next/static. */
export function scanSourceMaps(root) {
  const dir = join(root, '.next', 'static');
  if (!existsSync(dir)) return [];
  return walk(dir).filter((path) => path.endsWith('.map')).map((path) => `${path.slice(root.length + 1)} is a source map in the public bundle`);
}

/** No secret VALUE (length 8+) in the client bundle or the server output. Only the variable name is reported. */
export function scanSecretValues(root, env = process.env) {
  const problems = [];
  const secrets = SECRET_VALUE_NAMES.map((name) => [name, env[name] ?? '']).filter(([, value]) => value.length >= 8);
  if (secrets.length === 0) return problems;
  for (const sub of ['static', 'server']) {
    const dir = join(root, '.next', sub);
    if (!existsSync(dir)) continue;
    for (const path of walk(dir)) {
      if (!/\.(js|css|html|json|rsc|map|txt)$/.test(path)) continue;
      const text = readFileSync(path, 'utf8');
      for (const [name, value] of secrets) {
        if (text.includes(value)) problems.push(`${path.slice(root.length + 1)} contains the value of ${name}`);
      }
    }
  }
  return problems;
}

export const DEV_ONLY_OUTPUT = ['app/api/health', 'app/[locale]/_tokens', 'app/[locale]/_boom'];

/** On a release build the dev-only routes (health, _tokens, _boom) must be absent from the compiled server output. */
export function scanDevRoutes(root, release) {
  if (!release) return [];
  return DEV_ONLY_OUTPUT.filter((dir) => existsSync(join(root, '.next', 'server', dir))).map((dir) => `.next/server/${dir} exists in a release build`);
}

export function scanAll(root, env = process.env) {
  const release = env.NETLIFY === 'true' || env.MALVA_RELEASE_BUILD === '1';
  return [...scanBundle(root), ...scanSourceMaps(root), ...scanSecretValues(root, env), ...scanDevRoutes(root, release)];
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const problems = scanAll(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`bundle scan: ${problem}`);
    process.exit(1);
  }
  console.log('bundle scan: ok (no secret names or values in the bundle, no source maps in .next/static, dev-only routes checked)');
}
