import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NAMES = ['CLIENT_SECRET', 'SESSION_SECRET'];
const VALUE_VARS = ['CTP_CLIENT_SECRET', 'CTP_CLIENT_ID', 'SESSION_SECRET'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Scans a built client bundle directory (`.next/static`) for secret names and for the values of the secret env vars.
 * Returns `file: reason` lines; secret values are never included in the output.
 */
export function scanBundle(dir, env = {}) {
  const needles = NAMES.map((n) => ({ text: n, reason: `contains the name ${n}` }));
  for (const key of VALUE_VARS) {
    const value = env[key];
    if (value) needles.push({ text: value, reason: `contains the value of ${key}` });
  }
  const hits = [];
  let files;
  try {
    files = walk(dir);
  } catch {
    return [`${dir}: bundle directory not found (run the build first)`];
  }
  for (const file of files) {
    const content = readFileSync(file, 'latin1');
    for (const { text, reason } of needles) {
      if (content.includes(text)) hits.push(`${path.relative(dir, file)}: ${reason}`);
    }
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // no .env.local: only the process environment is used
  }
  const hits = scanBundle(path.join(process.cwd(), '.next', 'static'), process.env);
  if (hits.length > 0) {
    console.error(`Secret found in the client bundle:\n${hits.join('\n')}`);
    process.exit(1);
  }
}
