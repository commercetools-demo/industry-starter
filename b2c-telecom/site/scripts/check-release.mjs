import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const GUARD = /NODE_ENV\s*(?:===|!==|==|!=)\s*['"]development['"]/;
const NOT_FOUND = /\bnotFound\s*\(/;
const REQUIRED_ENV_NAMES = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'CTP_CHECKOUT_APP_KEY',
  'SESSION_SECRET',
];
// Telecom deviation: .env.example prefills the three non-secret project defaults (D-001); the other five stay empty.
const PREFILLED_OK = ['CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL'];
const NEVER_EXEMPT = ['CTP_CLIENT_SECRET', 'SESSION_SECRET'];
const BUILD_NETLIFY = 'npm run check:lockfile && npm run check:secrets && npm run build && npm run check:bundle';

/**
 * The `netlify.toml` this project must carry (Y-02). It lives in the project folder (`b2c-telecom/`, the parent of
 * `site/`); the Netlify UI "Package directory" points there. Compared ignoring blank lines and spacing.
 */
export const NETLIFY_TEMPLATE = `[build]
  base    = "site"
  command = "npm run build:netlify"
  publish = ".next"
  ignore  = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ../design ../plan ../openspec"

[build.environment]
  NODE_VERSION = "22"
  NEXT_TELEMETRY_DISABLED = "1"
  SECRETS_SCAN_OMIT_KEYS = "CTP_PROJECT_KEY,CTP_AUTH_URL,CTP_API_URL,CTP_SCOPES,CTP_CHECKOUT_APP_KEY,SITE_URL"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
`;

const normalize = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');

/** Files tracked by git below `dir`; empty outside a git checkout. Paths are relative to `dir`. */
function trackedFiles(dir) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Release-only checks (used by `verify:release`, not by `verify`). `rootDir` is `site/`; its parent is the project
 * folder `b2c-telecom/` ("repository root" in the plan) that holds `netlify.toml`. Returns a list of problems.
 */
export function checkRelease(rootDir) {
  const problems = [];
  const repoRoot = path.resolve(rootDir, '..');

  // 1, 2: netlify.toml
  const netlifyFile = path.join(repoRoot, 'netlify.toml');
  let toml = '';
  if (!existsSync(netlifyFile)) {
    problems.push('netlify.toml is missing at the repository root');
  } else {
    toml = readFileSync(netlifyFile, 'utf8');
    if (normalize(toml) !== normalize(NETLIFY_TEMPLATE)) {
      problems.push('netlify.toml does not match the template (base site, command npm run build:netlify, Node 22, plugin, headers)');
    }
  }

  // 3: no Vercel config
  for (const dir of [repoRoot, rootDir]) {
    if (existsSync(path.join(dir, 'vercel.json'))) problems.push('vercel.json must not exist (hosting is Netlify, D-002)');
  }

  // 4: tracked environment files
  for (const file of trackedFiles(repoRoot)) {
    const base = path.basename(file);
    if ((/^\.env(\..+)?$/.test(base) && !/\.example$/.test(base)) || base === '.envrc') {
      problems.push(`${file}: environment files must not be tracked`);
    }
  }

  // 5: .env.example lists the required names with empty values
  const exampleFile = path.join(rootDir, '.env.example');
  const example = existsSync(exampleFile) ? readFileSync(exampleFile, 'utf8') : '';
  for (const name of REQUIRED_ENV_NAMES) {
    const pattern = PREFILLED_OK.includes(name) ? `^${name}=` : `^${name}=\\s*$`;
    if (!new RegExp(pattern, 'm').test(example)) {
      problems.push(`.env.example must list ${name} with an empty value`);
    }
  }

  // 6: every security header is in the toml
  const headers = readJson(path.join(rootDir, 'config', 'security-headers.json')) ?? [];
  for (const header of headers) {
    const line = new RegExp(`^\\s*${header.key}\\s*=\\s*"${header.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*$`, 'm');
    if (!line.test(toml)) problems.push(`netlify.toml is missing security header ${header.key}`);
  }

  // 7: secret names are never exempt from the secrets scan
  const omit = toml.match(/^\s*SECRETS_SCAN_OMIT_KEYS\s*=\s*"([^"]*)"/m)?.[1] ?? '';
  const omitted = omit.split(',').map((name) => name.trim());
  for (const name of NEVER_EXEMPT) {
    if (omitted.includes(name)) problems.push(`SECRETS_SCAN_OMIT_KEYS must not include ${name}`);
  }

  // 8: build:netlify script
  const pkg = readJson(path.join(rootDir, 'package.json'));
  if (pkg?.scripts?.['build:netlify'] !== BUILD_NETLIFY) {
    problems.push('package.json build:netlify does not match the release template');
  }

  // 9: dev-only routes are guarded
  const appDir = path.join(rootDir, 'app');
  if (existsSync(appDir)) {
    for (const file of walk(appDir)) {
      const rel = path.relative(rootDir, file).split(path.sep);
      const name = rel.at(-1);
      const inDevDirectory = rel.slice(1, -1).includes('dev') || rel.slice(1, 3).join('/') === 'api/health';
      if (!inDevDirectory) continue;
      if (/\.test\./.test(name) || !/\.(ts|tsx|js|jsx|mjs)$/.test(name)) continue;
      // Telecom deviation: files named *.dev.ts(x) are not routes in production (pageExtensions in next.config.ts), so
      // they need no runtime guard; check:dev-routes proves their absence from the production build.
      if (/\.dev\.(ts|tsx)$/.test(name)) continue;
      const text = readFileSync(file, 'utf8');
      if (!GUARD.test(text) || !NOT_FOUND.test(text)) {
        problems.push(`${rel.join('/')}: dev-only route lacks the NODE_ENV === 'development' guard that calls notFound()`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkRelease(process.cwd());
  if (problems.length > 0) {
    console.error(`Release check failed:\n${problems.join('\n')}`);
    process.exit(1);
  }
}
