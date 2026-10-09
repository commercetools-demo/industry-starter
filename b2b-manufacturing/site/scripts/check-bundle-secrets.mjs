// Fails when a secret value or the word `client_secret` appears in the client bundle (.next/static).
// Secret values come from the environment (CTP_CLIENT_SECRET, CTP_PROV_CLIENT_SECRET, SESSION_SECRET) and from .env.local when present.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const SECRET_NAMES = ['CTP_CLIENT_SECRET', 'CTP_PROV_CLIENT_SECRET', 'SESSION_SECRET', 'CTP_CLIENT_ID', 'CTP_PROV_CLIENT_ID'];

export function secretValues(env, envFileText = '') {
  const fromFile = Object.fromEntries(envFileText.split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
  return SECRET_NAMES.map((n) => env[n] || fromFile[n]).filter((v) => v && v.length >= 8);
}

export function scanBundle(dir, secrets) {
  const problems = [];
  for (const file of walk(dir).filter((f) => /\.(js|css|html|json|map|txt)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    if (/client_secret/i.test(text)) problems.push(`${path.relative(dir, file)} contains "client_secret"`);
    for (const s of secrets) if (text.includes(s)) problems.push(`${path.relative(dir, file)} contains a secret value`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const problems = scanBundle('.next/static', secretValues(process.env, envFile));
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('bundle secrets: OK');
}
