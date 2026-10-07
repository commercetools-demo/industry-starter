import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Layering check for the storefront (workstream B, spec storefront-code-structure).
// Catches what ESLint cannot: transitive reaches from client code to server-only modules,
// missing `import 'server-only'` markers, SDK imports outside the server layer,
// client page modules and inline /api fetches outside hooks.

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs'];
const SCANNED_DIRS = ['app', 'components', 'hooks', 'context', 'lib', 'i18n'];
const IGNORED_DIRS = new Set(['node_modules', '.next']);
const CLIENT_DIRS = ['components', 'hooks', 'context'];
const SERVER_PACKAGES = ['@commercetools/platform-sdk', '@commercetools/ts-client', 'jose', 'next/headers'];
const SDK_PACKAGES = ['@commercetools/platform-sdk', '@commercetools/ts-client'];
const ENV_CORE = 'lib/ct/env-core.ts';
const FETCHER = 'lib/fetcher.ts';

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:type\s+)?[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const SERVER_ONLY_MARKER = /^\s*import\s*['"]server-only['"]/m;
const INLINE_API_FETCH = /\bfetch\(\s*(['"`])\/api\//;

const toPosix = (file) => file.split(path.sep).join('/');
const isTestFile = (rel) => /\.test\.[^/]+$/.test(rel) || rel.startsWith('test/');
const startsWithPackage = (specifier, pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`);

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function isClientModule(source) {
  return /^\s*['"]use client['"]/.test(stripComments(source));
}

function collectFiles(root, dir, out) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return;
  for (const entry of readdirSync(abs)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const rel = path.posix.join(dir, entry);
    const full = path.join(root, rel);
    if (statSync(full).isDirectory()) {
      collectFiles(root, rel, out);
    } else if (EXTENSIONS.includes(path.extname(entry)) && !isTestFile(rel)) {
      out.push(rel);
    }
  }
}

function scannedFiles(root) {
  const files = [];
  for (const dir of SCANNED_DIRS) collectFiles(root, dir, files);
  if (existsSync(path.join(root, 'proxy.ts'))) files.push('proxy.ts');
  return files;
}

/** Resolves an import to a root-relative file path, or returns the specifier when it is a package. */
function resolveImport(root, fromRel, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('./') || specifier.startsWith('../')) base = path.posix.join(path.posix.dirname(fromRel), specifier);
  else return specifier;
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => `${base}/index${ext}`)];
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return specifier;
}

function importsOf(source) {
  const code = stripComments(source);
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of code.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

/**
 * Returns the list of layering problems (empty = clean).
 * @param {string} rootDir the site directory
 * @returns {string[]}
 */
export function checkBoundaries(rootDir) {
  const root = path.resolve(rootDir);
  const problems = [];
  const cache = new Map();

  function info(rel) {
    let entry = cache.get(rel);
    if (!entry) {
      const source = readFileSync(path.join(root, rel), 'utf8');
      const specifiers = importsOf(source);
      entry = {
        source,
        specifiers,
        resolved: specifiers.map((specifier) => ({ specifier, target: resolveImport(root, rel, specifier) })),
        serverOnly:
          SERVER_ONLY_MARKER.test(stripComments(source)) ||
          ((rel.startsWith('lib/ct/') || rel.startsWith('lib/mappers/')) && rel !== ENV_CORE),
        client: isClientModule(source),
      };
      cache.set(rel, entry);
    }
    return entry;
  }

  const isFile = (target) => existsSync(path.join(root, target)) && statSync(path.join(root, target)).isFile();
  const isServerPackage = (target) => SERVER_PACKAGES.some((pkg) => startsWithPackage(target, pkg));

  const files = scannedFiles(root);

  // Rule 1: the client graph never reaches a server-only module.
  const roots = files.filter((rel) => CLIENT_DIRS.some((dir) => rel.startsWith(`${dir}/`)) || info(rel).client);
  for (const start of roots) {
    const reported = new Set();
    const visited = new Set([start]);
    const queue = [[start]];
    while (queue.length > 0) {
      const chain = queue.shift();
      const current = chain[chain.length - 1];
      const entry = info(current);
      if (entry.serverOnly) {
        if (!reported.has(current)) {
          reported.add(current);
          problems.push(`boundary: ${chain.join(' -> ')} (client code reaches a server-only module)`);
        }
        continue;
      }
      for (const { target } of entry.resolved) {
        if (isFile(target)) {
          if (visited.has(target)) continue;
          visited.add(target);
          queue.push([...chain, target]);
        } else if (isServerPackage(target) && !reported.has(target)) {
          reported.add(target);
          problems.push(`boundary: ${[...chain, target].join(' -> ')} (client code reaches a server-only module)`);
        }
      }
    }
  }

  for (const rel of files) {
    const entry = info(rel);
    const inCtOrMappers = rel.startsWith('lib/ct/') || rel.startsWith('lib/mappers/');

    // Rule 2: the server-only marker.
    if (rel.startsWith('lib/') && rel !== ENV_CORE) {
      const hasMarker = SERVER_ONLY_MARKER.test(stripComments(entry.source));
      if (inCtOrMappers) {
        if (!hasMarker) problems.push(`boundary: ${rel} is missing import 'server-only'`);
      } else if (!hasMarker) {
        for (const pkg of ['next/headers', ...SDK_PACKAGES]) {
          if (entry.specifiers.some((specifier) => startsWithPackage(specifier, pkg))) {
            problems.push(`boundary: ${rel} imports ${pkg} without import 'server-only'`);
          }
        }
      }
    }

    // Rule 3: the SDK stays in the server layer.
    if (!inCtOrMappers) {
      for (const pkg of SDK_PACKAGES) {
        if (entry.specifiers.some((specifier) => startsWithPackage(specifier, pkg))) {
          problems.push(`boundary: ${rel} imports ${pkg} (only lib/ct and lib/mappers may)`);
        }
      }
    }

    // Rule 4: pages and layouts are Server Components.
    if (rel.startsWith('app/') && /(^|\/)(page|layout)\.[^/]+$/.test(rel) && entry.client) {
      problems.push(`boundary: ${rel} is a client module (pages are Server Components)`);
    }

    // Rule 5: no inline /api fetch outside hooks.
    if (!rel.startsWith('hooks/') && rel !== FETCHER && INLINE_API_FETCH.test(stripComments(entry.source))) {
      problems.push(`boundary: ${rel} fetches /api inline (use a hook)`);
    }
  }

  return toUnique(problems);
}

function toUnique(list) {
  return [...new Set(list.map(toPosix))];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkBoundaries(process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
