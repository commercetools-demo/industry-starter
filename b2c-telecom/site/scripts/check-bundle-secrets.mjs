import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const SECRET_NAMES = ['CLIENT_SECRET', 'SESSION_SECRET', 'CTP_SEED', 'PEXELS_API_KEY'];
const VALUE_NAMES = ['CTP_CLIENT_SECRET', 'CTP_CLIENT_ID', 'SESSION_SECRET', 'CTP_SEED_CLIENT_ID', 'CTP_SEED_CLIENT_SECRET'];
const MIN_VALUE_LENGTH = 8; // shorter values would match unrelated text

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/**
 * Scans the client bundle for secret names and values. Returns the problems (empty = pass); values are never echoed.
 * @param {string} dir the .next/static directory
 * @param {Record<string, string | undefined>} env variables whose values must not appear
 * @returns {string[]}
 */
export function scanBundle(dir, env) {
  if (!existsSync(dir)) return ['bundle directory not found (run the build first)'];
  const problems = [];
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'latin1');
    const label = path.relative(path.dirname(dir), file);
    for (const name of SECRET_NAMES) {
      if (text.includes(name)) problems.push(`${label}: contains the name ${name}`);
    }
    for (const name of VALUE_NAMES) {
      const value = env[name];
      if (value && value.length >= MIN_VALUE_LENGTH && text.includes(value)) {
        problems.push(`${label}: contains the value of ${name}`);
      }
    }
  }
  return problems;
}

/**
 * Secret values to look for: the process environment plus site/.env.local and site/.env.seed when present.
 * @param {string} siteDir
 * @param {Record<string, string | undefined>} [base]
 * @returns {Record<string, string | undefined>}
 */
export function loadSecretValues(siteDir, base = process.env) {
  const env = { ...base };
  for (const file of ['.env.local', '.env.seed']) {
    const full = path.join(siteDir, file);
    if (existsSync(full)) Object.assign(env, parseEnv(readFileSync(full, 'utf8')));
  }
  return env;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = loadSecretValues(process.cwd());
  const problems = scanBundle(path.join(process.cwd(), '.next', 'static'), env);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
