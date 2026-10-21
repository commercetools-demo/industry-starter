// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Deploy gate (workstream Q, D9). Prints names, lengths and keys of the project; never a secret value.
//   npm run predeploy                    structure and files, plus the environment of the shell and of .env.production
// The dev routes (app/api/health, app/api/dev, app/[locale]/dev) are kept while the owner tests by hand; this gate lists them
// and fails until they are deleted.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Variables the running site cannot do without (names only). Optional: see .env.example. */
export const REQUIRED_ENV = [
  'CTP_PROJECT_KEY', 'EXPECTED_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPES',
  'SESSION_SECRET', 'NEXT_PUBLIC_SITE_URL', 'CTP_CHECKOUT_APP_KEY',
];
const REQUIRED_SCOPES = ['manage_recurring_orders', 'view_recurrence_policies'];
const ADMIN_SCOPES = ['manage_project', 'manage_api_clients', 'manage_extensions', 'manage_subscriptions', 'manage_import_containers', 'manage_products'];
const SAMPLE_SECRET = /^(change|example|sample|mock|test|secret|password|dummy)/i;
const PUBLIC_NAME_OK = new Set(['NEXT_PUBLIC_SITE_URL']);

/** Files and folders that must not ship. @returns {string[]} problems; empty means pass */
export function checkPredeploy(root) {
  const problems = [];
  if (existsSync(join(root, 'app', 'api', 'health', 'route.ts'))) {
    problems.push('Remove app/api/health/route.ts before deploying');
  }
  if (existsSync(join(root, 'app', 'api', 'dev'))) {
    problems.push('Remove app/api/dev before deploying');
  }
  if (existsSync(join(root, 'app', '[locale]', 'dev'))) {
    problems.push('Remove app/[locale]/dev (the design kitchen sink) before deploying');
  }
  return problems;
}

/** Any route or page folder named dev, debug or test under app/. @returns {string[]} */
export function checkDebugRoutes(root) {
  const found = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      const path = `${rel}/${name}`;
      if (/^(debug|test)$/i.test(name)) found.push(`Remove ${path}: a route named ${name} must not ship`);
      walk(full, path);
    }
  };
  walk(join(root, 'app'), 'app');
  return found;
}

/** The environment of the target. @param {Record<string, string | undefined>} env @returns {string[]} problems, names only */
export function checkPredeployEnv(env) {
  const problems = [];
  for (const name of REQUIRED_ENV) {
    if (!env[name]) problems.push(`${name} is not set`);
  }
  const secret = env.SESSION_SECRET;
  if (secret) {
    if (secret.length < 32) problems.push(`SESSION_SECRET is shorter than 32 characters (length ${secret.length})`);
    else if (SAMPLE_SECRET.test(secret)) problems.push('SESSION_SECRET looks like a sample value');
  }
  if (env.CTP_PROJECT_KEY && env.EXPECTED_PROJECT_KEY && env.CTP_PROJECT_KEY !== env.EXPECTED_PROJECT_KEY) {
    problems.push(`EXPECTED_PROJECT_KEY (${env.EXPECTED_PROJECT_KEY}) does not equal CTP_PROJECT_KEY (${env.CTP_PROJECT_KEY})`);
  }
  if (env.CTP_SCOPES) {
    const scopes = env.CTP_SCOPES.split(/\s+/).filter(Boolean).map((s) => s.split(':')[0]);
    for (const required of REQUIRED_SCOPES) {
      if (!scopes.includes(required)) problems.push(`CTP_SCOPES is missing ${required}`);
    }
    for (const admin of ADMIN_SCOPES) {
      if (scopes.includes(admin)) problems.push(`CTP_SCOPES contains the admin scope ${admin}; the storefront client must not hold it`);
    }
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_') && !PUBLIC_NAME_OK.has(name) && /SECRET|TOKEN|PASSWORD|KEY|CLIENT/i.test(name)) {
      problems.push(`${name} is public to the browser but is named like a secret`);
    }
  }
  return problems;
}

/**
 * Tracked files and imports. @param {string} root
 * @param {string[]} tracked paths from `git ls-files`, relative to root
 * @returns {string[]} problems
 */
export function checkPredeployFiles(root, tracked) {
  const problems = [];
  for (const file of tracked) {
    const base = file.split('/').pop() ?? '';
    if (/^\.env/.test(base) && base !== '.env.example') problems.push(`${file} is tracked by git; remove it from the index`);
  }
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) scan(full);
      else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\./.test(name) && /['"`/]scripts\/dev\//.test(readFileSync(full, 'utf8'))) {
        problems.push(`${full.slice(root.length + 1)} references scripts/dev`);
      }
    }
  };
  for (const dir of ['app', 'lib', 'components']) scan(join(root, dir));
  const nvmrc = existsSync(join(root, '.nvmrc')) ? readFileSync(join(root, '.nvmrc'), 'utf8').trim() : '';
  if (!/^v?22(\.|$)/.test(nvmrc)) problems.push(`.nvmrc must pin Node 22 (found "${nvmrc}")`);
  return problems;
}

function loadEnv(root) {
  const env = { ...process.env };
  const file = join(root, '.env.production');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  let tracked = [];
  try {
    tracked = execFileSync('git', ['ls-files', '.'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    // not a git checkout (a scratch copy): the tracked-file check is skipped
  }
  const problems = [
    ...checkPredeploy(root), ...checkDebugRoutes(root), ...checkPredeployFiles(root, tracked), ...checkPredeployEnv(loadEnv(root)),
  ];
  if (problems.length > 0) {
    for (const p of problems) console.error(`predeploy: ${p}`);
    process.exit(1);
  }
  console.log('predeploy: ok');
}
