#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Release gates (workstream Z-03): runs every offline check of every package and prints pass or fail per gate.
// No dependencies; needs no credentials: the builds run on a DUMMY environment (fake keys, example.test hosts) and
// no step talks to commercetools. Nothing here writes to a commercetools project.
//
//   node plans/release-gates.mjs                      all gates, build gates in a scratch copy of this working tree
//   node plans/release-gates.mjs --only seed,portal   some packages (plans, seed, storefront, portal)
//   node plans/release-gates.mjs --skip-build         skip the `verify:build` gates (they take minutes)
//   node plans/release-gates.mjs --scratch <dir>      scratch directory (default: <os tmpdir>/malva-release-gates)
//   node plans/release-gates.mjs --reuse-scratch      keep the scratch copy (and its build cache) of the previous run
//   node plans/release-gates.mjs --install            in the scratch copy run `npm ci` (network) instead of cloning node_modules
//   node plans/release-gates.mjs --report <file>      also write the result table (markdown) to a file
//
// Gates per package (the in-place gates run in this working tree, with its installed node_modules):
//   plans             verify-plan --sync --strict (regenerates the generated blocks), verify-manual --structure, plans/*.test.mjs, spec-coverage refresh
//   seed              npm run check                      (tsc + vitest, FakeApi; includes the reset and purge tests)
//   storefront        npm run check, then verify:build in the scratch copy (build + route, secret and bundle gates)
//   portal            npm run check, then verify:build in the scratch copy
// A clean-clone run (`git clone --no-hardlinks`, check out the commit, then this script with --install) proves the same gates
// without any local state; the default mode clones node_modules from the working tree so it works offline.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const ALL = ['plans', 'seed', 'storefront', 'portal'];
const only = (opt('--only') ?? ALL.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const scratch = path.resolve(opt('--scratch') ?? path.join(os.tmpdir(), 'malva-release-gates'));
const logs = path.join(scratch, 'logs');

/** Dummy environment: never a real secret, never a reachable host. */
export const DUMMY_ENV = {
  // the same values as storefront/test/env.ts and portal/test/env.ts, because some tests assert on them
  CTP_PROJECT_KEY: 'test-project',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'test-client-id',
  CTP_CLIENT_SECRET: 'test-client-secret',
  CTP_SCOPES: 'view_stores view_project_settings',
  CTP_ADMIN_CLIENT_ID: 'test-admin-client-id',
  CTP_ADMIN_CLIENT_SECRET: 'test-admin-client-secret',
  CTP_ADMIN_SCOPES: 'manage_key_value_documents',
  CTP_PROVISION_CLIENT_ID: 'test-provision-client-id',
  CTP_PROVISION_CLIENT_SECRET: 'test-provision-client-secret',
  CTP_PROVISION_SCOPES: 'manage_business_units',
  SESSION_SECRET: 'x'.repeat(48),
  ORDER_ACCESS_SECRET: 'o'.repeat(48),
  CONTENTOOLS_ORIGIN: 'https://contentools.example.test',
  NOMINATIM_CONTACT: 'ops@example.test',
  NEXT_TELEMETRY_DISABLED: '1',
};
const cleanEnv = () => {
  const env = { ...process.env };
  // a developer shell must not leak real settings into the gates
  for (const k of Object.keys(env)) if (/^(CTP_|SEED_|SESSION_SECRET|ORDER_ACCESS_SECRET|IMPERSONATION_SECRET|DEMO_|ATTACK_MODE|RELEASE$|CONTEXT$|NODE_ENV$|CONTENTOOLS_|PORTAL_ORIGIN|STOREFRONT_ORIGIN|CSP_IMG_HOSTS)/.test(k)) delete env[k];
  return { ...env, ...DUMMY_ENV };
};

// every run starts from a fresh scratch copy (no build cache from an earlier run) unless --reuse-scratch is given
if (!flag('--reuse-scratch')) rmSync(path.join(scratch, 'tree'), { recursive: true, force: true });
const results = [];
function gate(pkg, name, cwd, command, env = cleanEnv()) {
  const t0 = Date.now();
  mkdirSync(logs, { recursive: true });
  const logFile = path.join(logs, `${pkg}-${name.replace(/[^a-z0-9]+/gi, '-')}.log`);
  process.stdout.write(`... ${pkg.padEnd(17)} ${name} `);
  const r = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  writeFileSync(logFile, `$ ${command}\n(cwd ${cwd})\n\n${out}`);
  const ok = r.status === 0;
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`${ok ? 'PASS' : 'FAIL'} (${secs}s)`);
  if (!ok) console.log(out.split('\n').slice(-12).map((l) => `      ${l}`).join('\n'));
  results.push({ pkg, name, ok, secs, logFile, tail: out.trim().split('\n').slice(-3).join(' / ').slice(0, 220) });
  return ok;
}

function scratchCopy(pkg) {
  const dest = path.join(scratch, 'tree');
  if (!existsSync(path.join(dest, '.copied'))) {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    const skip = new Set(['node_modules', '.next', '.git', '.claude', '.env.local', 'evidence']);
    cpSync(ROOT, dest, { recursive: true, filter: (src) => !skip.has(path.basename(src)) && !/\.env\.[a-z]*\.?local$/.test(src) });
    writeFileSync(path.join(dest, '.copied'), new Date().toISOString());
  }
  const pkgDir = path.join(dest, pkg);
  if (flag('--install')) {
    if (!gate(pkg, 'npm ci (scratch copy)', pkgDir, 'npm ci --no-audit --no-fund')) return null;
  } else if (!existsSync(path.join(pkgDir, 'node_modules'))) {
    // copy-on-write clone where the file system supports it (macOS APFS), else a plain recursive copy
    const src = path.join(ROOT, pkg, 'node_modules');
    const clone = spawnSync('cp', [process.platform === 'darwin' ? '-cR' : '-R', src, pkgDir + '/']);
    if (clone.status !== 0) { console.log(`      cannot copy node_modules of ${pkg}: ${clone.stderr}`); return null; }
  }
  return pkgDir;
}

const wants = (p) => only.includes(p);
if (wants('plans')) {
  gate('plans', 'verify-plan --sync --strict', ROOT, 'node plans/verify-plan.mjs --sync --strict');
  gate('plans', 'verify-manual --structure', ROOT, 'node plans/verify-manual.mjs --structure');
  gate('plans', 'plans/*.test.mjs', ROOT, 'node --test plans/*.test.mjs');
  gate('plans', 'spec-coverage (refresh)', ROOT, 'node plans/spec-coverage.mjs');
}
if (wants('seed')) gate('seed', 'npm run check', path.join(ROOT, 'seed'), 'npm run check');
for (const app of ['storefront', 'portal']) {
  if (!wants(app)) continue;
  gate(app, 'npm run check', path.join(ROOT, app), 'npm run check');
  if (flag('--skip-build')) continue;
  const dir = scratchCopy(app);
  if (dir) gate(app, 'npm run verify:build (scratch copy)', dir, 'npm run verify:build');
  else results.push({ pkg: app, name: 'npm run verify:build (scratch copy)', ok: false, secs: 0, logFile: '-', tail: 'scratch copy failed' });
}

const failed = results.filter((r) => !r.ok);
const table = [
  '| Package | Gate | Result | Seconds | Last output |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.pkg} | ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.secs} | ${r.tail.replace(/\|/g, '/')} |`),
].join('\n');
console.log(`\n${table}\n\nrelease gates: ${failed.length ? `FAILED (${failed.map((f) => `${f.pkg}: ${f.name}`).join('; ')})` : 'all PASS'}  logs in ${logs}`);
if (opt('--report')) {
  writeFileSync(path.resolve(opt('--report')), `<!-- SPDX-License-Identifier: MIT -->\n<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->\n\n# Release gates (generated by plans/release-gates.mjs)\n\nRun ${new Date().toISOString()} on ${os.platform()}, Node ${process.version}, dummy environment, offline. Mode: ${flag('--install') ? 'npm ci in the scratch copy' : 'node_modules cloned into the scratch copy'}.\n\n${table}\n\nResult: ${failed.length ? 'FAILED' : 'all PASS'}\n`);
}
process.exit(failed.length ? 1 : 0);
