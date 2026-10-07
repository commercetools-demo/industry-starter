import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', '.git']);
const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.test\.[a-z]+$/;
const PUBLIC_SECRET = /NEXT_PUBLIC_[A-Z0-9_]*(CTP|SESSION|SECRET|SEED|PEXELS)/;
const SECRET_LITERAL = /\b(SESSION_SECRET|CLIENT_SECRET)\b\s*[:=]\s*(['"`])[^'"`\n]{32,}\2/;
const MUST_BE_EMPTY = [
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'SESSION_SECRET',
  'CTP_CHECKOUT_APP_KEY',
  'CTP_SEED_CLIENT_ID',
  'CTP_SEED_CLIENT_SECRET',
];
const EXAMPLE_FILES = ['.env.example', '.env.seed.example'];

function walk(root, dir = root) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, full));
    else files.push(path.relative(root, full));
  }
  return files;
}

function listFiles(rootDir) {
  try {
    const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\0')
      .filter(Boolean)
      .filter((file) => !file.split('/').some((part) => IGNORED_DIRECTORIES.has(part)));
  } catch {
    return walk(rootDir);
  }
}

function read(rootDir, file) {
  try {
    if (!statSync(path.join(rootDir, file)).isFile()) return undefined;
    return readFileSync(path.join(rootDir, file), 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Returns the secret-hygiene problems of the site directory (empty = pass). Never includes a secret value.
 * @param {string} rootDir the site directory
 * @returns {string[]}
 */
export function checkSecrets(rootDir) {
  const problems = [];
  for (const file of listFiles(rootDir)) {
    const base = path.basename(file);
    const inScripts = file.startsWith('scripts/');

    // (c) env files must not be tracked (the two example files are allowed).
    if (base.startsWith('.env') && !EXAMPLE_FILES.includes(base)) {
      problems.push(`${file}: env file must not be tracked`);
      continue;
    }

    // (b) example env files carry no secret values and no seed credentials.
    if (EXAMPLE_FILES.includes(base) && file === base) {
      const text = read(rootDir, file) ?? '';
      const lines = text.split('\n');
      for (const name of MUST_BE_EMPTY) {
        const line = lines.find((candidate) => candidate.startsWith(`${name}=`));
        if (line && line.slice(name.length + 1).trim() !== '') problems.push(`${base}: ${name} must be empty`);
      }
      if (base === '.env.example' && /CTP_SEED_/.test(text)) {
        problems.push(`${base}: seed credentials must not be configured for site/`);
      }
      continue;
    }

    if (!CODE_EXTENSIONS.test(file) || inScripts || TEST_FILE.test(file)) continue;
    const text = read(rootDir, file);
    if (text === undefined) continue;

    // (a) secrets never get the public prefix.
    if (PUBLIC_SECRET.test(text)) problems.push(`${file}: contains NEXT_PUBLIC_… (server secrets must never be public)`);
    // (d) no secret literal in source.
    if (SECRET_LITERAL.test(text)) problems.push(`${file}: string literal assigned to a secret variable`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkSecrets(existsSync(path.join(process.cwd(), 'package.json')) ? process.cwd() : path.resolve('.'));
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
