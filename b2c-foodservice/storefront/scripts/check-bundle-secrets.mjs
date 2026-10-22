// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Client bundle scan: no secret value may appear in browser-reachable build output.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every server-only value named in .env.example (names only; the test below keeps this list in step with the file). */
export const SECRET_NAMES = [
  'CTP_CLIENT_SECRET', 'CTP_CLIENT_ID', 'SESSION_SECRET', 'CTP_REVIEWS_CLIENT_ID', 'CTP_REVIEWS_CLIENT_SECRET',
  'DEMO_LOGIN_PASSWORD', 'CONTACT_WEBHOOK_URL', 'CONTACT_WEBHOOK_TOKEN', 'FEEDBACK_WEBHOOK_URL',
];
const MIN_LENGTH = 8;

function walk(dir, accept) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, accept);
    return accept(path) ? [path] : [];
  });
}

/**
 * @param {string} root storefront directory
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} problems naming the variable and file, never the value
 */
export function checkBundleSecrets(root, env) {
  const files = [
    ...walk(join(root, '.next', 'static'), () => true),
    // the HTML and the .rsc payloads: what a server component sends to the browser on a visit or a navigation
    ...walk(join(root, '.next', 'server', 'app'), (p) => p.endsWith('.html') || p.endsWith('.rsc')),
  ];
  const problems = [];
  const secrets = SECRET_NAMES.map((name) => [name, env[name]]).filter(
    ([, value]) => typeof value === 'string' && value.length >= MIN_LENGTH,
  );
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const [name, value] of secrets) {
      if (text.includes(value)) {
        problems.push(`${name} value found in client output ${relative(root, file)}`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  // Load values from .env.local the way Next does, without printing them.
  const env = { ...process.env };
  const envFile = join(root, '.env.local');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const problems = checkBundleSecrets(root, env);
  if (problems.length > 0) {
    for (const p of problems) console.error(`bundle scan: ${p}`);
    process.exit(1);
  }
  const checked = SECRET_NAMES.filter((n) => (env[n] ?? '').length >= MIN_LENGTH);
  console.log(`bundle scan: ok (checked ${checked.length} of ${SECRET_NAMES.length} secret values)`);
}
