// Secret in the bundle: fails when a secret value (or the word client_secret) appears in .next/static.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BUNDLE_SECRET_NAMES } from './app.config.mjs';
import { runCli, walk } from './fs-utils.mjs';

/** Values (8 characters or longer) of the secret variables, from the environment and from .env.local. */
export function secretValues(env, envFileText = '') {
  const fromFile = Object.fromEntries(
    envFileText
      .split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
  );
  return BUNDLE_SECRET_NAMES.map((n) => env[n] || fromFile[n]).filter((v) => v && v.length >= 8);
}

/** Three base64url parts that look like a JWT (workstream X-12): a leaked Contentools or session token is greppable. */
export const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/;

export function scanBundle(dir, secrets) {
  const problems = [];
  for (const file of walk(dir).filter((f) => /\.(js|css|html|json|map|txt)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    if (/client_secret/i.test(text)) problems.push(`${path.relative(dir, file)} contains "client_secret"`);
    if (JWT_SHAPE.test(text)) problems.push(`${path.relative(dir, file)} contains a JWT-shaped string`);
    for (const s of secrets) if (text.includes(s)) problems.push(`${path.relative(dir, file)} contains a secret value`);
  }
  return problems;
}

runCli(
  import.meta.url,
  (root) => {
    const envFile = path.join(root, '.env.local');
    const secrets = secretValues(process.env, existsSync(envFile) ? readFileSync(envFile, 'utf8') : '');
    return [...scanBundle(path.join(root, '.next', 'static'), secrets), ...scanBundle(path.join(root, 'public'), secrets).map((p) => 'public/' + p)];
  },
  'bundle secrets',
);
