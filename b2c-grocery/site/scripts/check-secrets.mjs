import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_PUBLIC = ['NEXT_PUBLIC_CTP', 'NEXT_PUBLIC_SESSION'];
const MUST_BE_EMPTY = ['CTP_CLIENT_SECRET', 'CTP_CLIENT_ID', 'SESSION_SECRET', 'CTP_CHECKOUT_APP_KEY'];
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf']);
const LITERAL_SECRET = /\b(SESSION_SECRET|CLIENT_SECRET)\b\s*[:=]\s*(['"`])[^'"`\n]{32,}\2/;

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

/** Tracked files (plus new, not-ignored ones) under `rootDir`; falls back to a directory walk outside git. */
function listFiles(rootDir) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return walk(rootDir);
  }
}

const isExcluded = (rel) => {
  const parts = rel.split(path.sep).join('/').split('/');
  return parts[0] === 'scripts' || parts.includes('.next') || parts.includes('node_modules') || /\.test\./.test(parts.at(-1));
};

/**
 * Local secret guard. `rootDir` is the project root (site/). Returns a list of violations (empty = clean).
 * Never includes secret values in the messages.
 */
export function checkSecrets(rootDir) {
  const problems = [];
  const files = listFiles(rootDir);

  for (const rel of files) {
    const base = path.basename(rel);
    if (base.startsWith('.env') && base !== '.env.example') {
      problems.push(`${rel}: env file must not be tracked (only .env.example)`);
    }
    if (isExcluded(rel) || BINARY_EXT.has(path.extname(rel).toLowerCase())) continue;
    let text;
    try {
      text = readFileSync(path.join(rootDir, rel), 'utf8');
    } catch {
      continue;
    }
    for (const needle of FORBIDDEN_PUBLIC) {
      if (text.includes(needle)) problems.push(`${rel}: contains ${needle} (server secrets must never be NEXT_PUBLIC)`);
    }
    if (SOURCE_EXT.has(path.extname(rel)) && LITERAL_SECRET.test(text)) {
      problems.push(`${rel}: string literal assigned to a secret variable`);
    }
  }

  let example = null;
  try {
    example = readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  } catch {
    // no .env.example: nothing to check
  }
  if (example !== null) {
    for (const line of example.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && MUST_BE_EMPTY.includes(match[1]) && match[2] !== '') {
        problems.push(`.env.example: ${match[1]} must be empty`);
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkSecrets(process.cwd());
  if (problems.length > 0) {
    console.error(`Secret guard failed:\n${problems.join('\n')}`);
    process.exit(1);
  }
}
