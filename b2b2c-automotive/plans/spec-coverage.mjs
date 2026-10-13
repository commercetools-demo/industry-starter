#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Spec coverage: maps every requirement and scenario of the in-scope specs to the tests and evidence that mention it,
// and every spec to the code its workstream names. No dependencies.
//   node plans/spec-coverage.mjs           writes plans/evidence/Z/spec-coverage.md and the COVERAGE block of plans/SPEC-COVERAGE.md
//   node plans/spec-coverage.mjs --check   writes nothing; exit 1 when the written files are stale
//   node plans/spec-coverage.mjs --strict  also exit 1 when any scenario is UNCOVERED
//
// In scope = every spec under openspec/specs/{consumer-storefront,seller-portal} named bootstrap-and-structure,
// theming-design or design-*, minus specs carrying the marker line <!-- OUT-OF-SCOPE --> (same rule as verify-plan.mjs).
//
// A scenario is matched, strongest first, by:
//   TEST      its title is inside a describe/it/test name of a test file (short titles must equal or prefix the name)
//   MAPPED    a workstream line that names the scenario also names an existing test file (scenario maps, [SPEC: ...] tasks)
//   EVIDENCE  its title appears in plans/evidence/**/*.md (recipe logs, READMEs, reports)
//   PLANNED   only a workstream file names it: the plan exists, nothing proves it yet
//   UNCOVERED nothing mentions it
// TEST is a name match, not a proof that the assertion is right; MAPPED, EVIDENCE and PLANNED are weaker still. The
// report says so and lists every non-TEST scenario.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const norm = (s) => s.toLowerCase().replace(/[`'"*_]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const OWNED = /^(bootstrap-and-structure|theming-design|design-.+)$/;
const APPS = { cs: ['consumer-storefront', 'storefront'], sp: ['seller-portal', 'portal'] };
const RANK = { TEST: 4, MAPPED: 3, EVIDENCE: 2, PLANNED: 1, UNCOVERED: 0 };

/** Requirements and scenarios of one spec.md. */
export function parseSpec(text) {
  const reqs = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const r = line.match(/^### Requirement:\s*(.+?)\s*$/);
    const s = line.match(/^#### Scenario:\s*(.+?)\s*$/);
    if (r) { cur = { title: r[1], scenarios: [] }; reqs.push(cur); }
    else if (s) { if (!cur) { cur = { title: '(no requirement)', scenarios: [] }; reqs.push(cur); } cur.scenarios.push(s[1]); }
  }
  return reqs;
}

/** Names inside describe/it/test calls of a test file, normalised. */
export function testNames(source) {
  const names = [];
  for (const m of source.matchAll(/\b(?:describe|it|test)(?:\.[a-z]+)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) names.push(norm(m[2]));
  return names;
}

function walk(dir, accept, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'dist', 'coverage'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, accept, out);
    else if (accept(p)) out.push(p);
  }
  return out;
}

/** Does a normalised test name match a normalised scenario title? Short titles must equal or prefix the name. */
export function nameMatches(name, title) {
  if (!title) return false;
  if (title.split(' ').length >= 3 || title.length >= 18) return name.includes(title);
  return name === title || (title.includes(' ') && name.startsWith(`${title} `));
}

export function classify({ title, testIndex, planLines, evidenceTexts, testFileSet }) {
  const t = norm(title);
  const tests = [];
  for (const [file, names] of testIndex) if (names.some((n) => nameMatches(n, t))) tests.push(file);
  const mapped = new Set();
  let planned = false;
  for (const { text, n } of planLines) {
    if (!n.includes(t)) continue;
    planned = true;
    for (const f of text.matchAll(/[A-Za-z0-9_./\[\]()-]+\.test\.[mc]?[jt]sx?/g)) {
      const base = path.basename(f[0]);
      for (const real of testFileSet.get(base) ?? []) mapped.add(real);
    }
  }
  const evidence = evidenceTexts.filter((e) => e.n.includes(t) && t.split(' ').length >= 2).map((e) => e.file);
  if (tests.length) return { level: 'TEST', refs: tests };
  if (mapped.size) return { level: 'MAPPED', refs: [...mapped] };
  if (evidence.length) return { level: 'EVIDENCE', refs: evidence };
  if (planned) return { level: 'PLANNED', refs: [] };
  return { level: 'UNCOVERED', refs: [] };
}

export function analyse(root) {
  const plans = path.join(root, 'plans');
  const specs = [];
  for (const [short, [dir]] of Object.entries(APPS)) {
    const base = path.join(root, 'openspec/specs', dir);
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base, { withFileTypes: true }).filter((x) => x.isDirectory() && OWNED.test(x.name))) {
      const f = path.join(base, d.name, 'spec.md');
      if (!existsSync(f)) continue;
      const text = readFileSync(f, 'utf8');
      if (/^<!-- OUT-OF-SCOPE -->\s*$/m.test(text)) continue;
      specs.push({ id: `${short}/${d.name}`, app: short, reqs: parseSpec(text) });
    }
  }
  specs.sort((a, b) => a.id.localeCompare(b.id));

  const testFiles = [...walk(path.join(root, 'storefront'), (p) => /\.test\.[mc]?[jt]sx?$/.test(p)), ...walk(path.join(root, 'portal'), (p) => /\.test\.[mc]?[jt]sx?$/.test(p)), ...walk(path.join(root, 'seed'), (p) => /\.test\.[mc]?[jt]sx?$/.test(p)), ...walk(path.join(root, 'tools'), (p) => /\.test\.[mc]?[jt]sx?$/.test(p))];
  const testIndex = new Map(testFiles.map((f) => [path.relative(root, f), testNames(readFileSync(f, 'utf8'))]));
  const testFileSet = new Map();
  for (const f of testIndex.keys()) testFileSet.set(path.basename(f), [...(testFileSet.get(path.basename(f)) ?? []), f]);

  const wsDir = path.join(plans, 'workstreams');
  const wsFiles = readdirSync(wsDir).filter((f) => /^[A-Z]-.+\.md$/.test(f));
  const planLines = [];
  const wsText = {};
  for (const f of wsFiles) {
    const text = readFileSync(path.join(wsDir, f), 'utf8');
    wsText[f[0]] = text;
    for (const text2 of text.split('\n')) planLines.push({ text: text2, n: norm(text2) });
  }
  const evidenceTexts = walk(path.join(plans, 'evidence'), (p) => p.endsWith('.md') && !p.includes(`${path.sep}evidence${path.sep}Z${path.sep}`)).map((p) => ({ file: path.relative(root, p), n: norm(readFileSync(p, 'utf8')) }));

  // implementing code: existing non-test paths named in backticks by the workstream(s) that list the spec
  const planText = readFileSync(path.join(plans, 'DEPENDENCY-PLAN.md'), 'utf8');
  const owners = {};
  for (const line of planText.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length >= 8 && /^[A-Z]$/.test(c[1])) for (const m of c[3].matchAll(/\b(cs|sp)\/([a-z0-9-]+)/g)) (owners[`${m[1]}/${m[2]}`] ??= []).push(c[1]);
  }
  const missed = existsSync(path.join(plans, 'MISSED-FEATURES.md')) ? readFileSync(path.join(plans, 'MISSED-FEATURES.md'), 'utf8').split('\n').filter((l) => l.startsWith('|')) : [];

  const out = [];
  for (const spec of specs) {
    const appDir = APPS[spec.app][1];
    const codeCount = new Map();
    for (const L of owners[spec.id] ?? []) {
      for (const m of (wsText[L] ?? '').matchAll(/`([A-Za-z0-9_./\[\]()@-]+\.(?:tsx?|mjs|css|json))`/g)) {
        const rel = m[1].replace(/^\.\//, '');
        if (/\.test\./.test(rel)) continue;
        const candidates = [rel, path.join(appDir, rel), path.join('seed', rel), path.join('seed/src', rel)];
        const hit = candidates.find((c) => existsSync(path.join(root, c)) && statSync(path.join(root, c)).isFile());
        if (hit && (hit.startsWith(appDir) || rel.startsWith(appDir))) codeCount.set(hit, (codeCount.get(hit) ?? 0) + 1);
      }
    }
    const code = [...codeCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f);
    const specName = spec.id.split('/')[1];
    const knownGaps = missed.filter((l) => l.includes(specName)).length;
    const reqs = spec.reqs.map((r) => ({ title: r.title, scenarios: r.scenarios.map((title) => ({ title, ...classify({ title, testIndex, planLines, evidenceTexts, testFileSet }) })) }));
    out.push({ ...spec, owners: [...new Set(owners[spec.id] ?? [])], code, knownGaps, reqs });
  }
  return { specs: out, testFileCount: testFiles.length };
}

const LEVELS = ['TEST', 'MAPPED', 'EVIDENCE', 'PLANNED', 'UNCOVERED'];
const count = (spec, level) => spec.reqs.flatMap((r) => r.scenarios).filter((s) => s.level === level).length;

export function renderSummary({ specs, testFileCount }) {
  const rows = ['| Spec | Workstream | Scenarios | TEST | MAPPED | EVIDENCE | PLANNED | UNCOVERED | Known gaps (MISSED-FEATURES rows) | Implementing code (named by the workstream, first 4) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  const tot = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let scen = 0;
  for (const s of specs) {
    const n = s.reqs.reduce((a, r) => a + r.scenarios.length, 0);
    scen += n;
    for (const l of LEVELS) tot[l] += count(s, l);
    rows.push(`| ${s.id} | ${s.owners.join(', ') || '-'} | ${n} | ${LEVELS.map((l) => count(s, l)).join(' | ')} | ${s.knownGaps} | ${s.code.slice(0, 4).map((c) => `\`${c}\``).join(', ') || '-'} |`);
  }
  rows.push(`| **Total (${specs.length} specs)** | | **${scen}** | ${LEVELS.map((l) => `**${tot[l]}**`).join(' | ')} | | |`);
  return [
    `${specs.length} in-scope specs, ${scen} scenarios, ${testFileCount} test files scanned. Levels, strongest first: TEST (title inside a describe/it/test name), MAPPED (a workstream scenario map or task names the scenario and an existing test file), EVIDENCE (title appears in \`plans/evidence/**/*.md\`), PLANNED (only a workstream names it), UNCOVERED (nothing). TEST is a name match, not proof that the assertion is right; the weaker levels are listed as gaps in \`plans/evidence/Z/spec-coverage.md\`. Scenarios that only a live project, a browser or the owner can prove are expected to stay below TEST: their rows are in \`plans/TODO-MANUAL-TESTING.md\`.`,
    '',
    ...rows,
  ].join('\n');
}

export function renderDetail({ specs }) {
  const out = ['<!-- SPDX-License-Identifier: MIT -->', '<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->', '', '# Spec coverage report (workstream Z-02)', '', 'Generated by `node plans/spec-coverage.mjs`; do not edit.', '', renderSummary({ specs, testFileCount: 0 }).split('\n').slice(1).join('\n'), '', '## Gaps (every scenario that is not TEST)', '', '| Spec | Requirement | Scenario | Level | Where it is mentioned |', '| --- | --- | --- | --- | --- |'];
  for (const s of specs) for (const r of s.reqs) for (const sc of r.scenarios) if (sc.level !== 'TEST') out.push(`| ${s.id} | ${r.title} | ${sc.title} | ${sc.level} | ${sc.refs.slice(0, 2).map((x) => `\`${x}\``).join(', ') || '-'} |`);
  out.push('', '## Every scenario', '');
  for (const s of specs) {
    out.push(`### ${s.id}`, '', `Workstream: ${s.owners.join(', ') || '-'}. Code: ${s.code.slice(0, 10).map((c) => `\`${c}\``).join(', ') || '-'}.`, '', '| Requirement | Scenario | Level | Tests or evidence |', '| --- | --- | --- | --- |');
    for (const r of s.reqs) for (const sc of r.scenarios) out.push(`| ${r.title} | ${sc.title} | ${sc.level} | ${sc.refs.slice(0, 3).map((x) => `\`${x}\``).join(', ') || '-'}${sc.refs.length > 3 ? ` (+${sc.refs.length - 3})` : ''} |`);
    out.push('');
  }
  return out.join('\n');
}

const BEGIN = '<!-- COVERAGE:BEGIN (generated by plans/spec-coverage.mjs) -->';
const END = '<!-- COVERAGE:END -->';
export function withBlock(text, body) {
  const b = text.indexOf(BEGIN);
  const e = text.indexOf(END);
  if (b < 0 || e < 0) return `${text.replace(/\s*$/, '')}\n\n## Test and evidence coverage\n\n${BEGIN}\n${body}\n${END}\n`;
  return `${text.slice(0, b)}${BEGIN}\n${body}\n${text.slice(e)}`;
}

function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const result = analyse(root);
  const detail = `${renderDetail(result)}\n`;
  const detailPath = path.join(root, 'plans/evidence/Z/spec-coverage.md');
  const covPath = path.join(root, 'plans/SPEC-COVERAGE.md');
  const cov = withBlock(readFileSync(covPath, 'utf8'), renderSummary(result));
  const uncovered = result.specs.reduce((a, s) => a + count(s, 'UNCOVERED'), 0);
  if (process.argv.includes('--check')) {
    const stale = !existsSync(detailPath) || readFileSync(detailPath, 'utf8') !== detail || readFileSync(covPath, 'utf8') !== cov;
    console.log(stale ? 'spec-coverage: STALE (run node plans/spec-coverage.mjs)' : 'spec-coverage: up to date');
    process.exit(stale ? 1 : 0);
  }
  mkdirSync(path.dirname(detailPath), { recursive: true });
  writeFileSync(detailPath, detail);
  writeFileSync(covPath, cov);
  const tot = Object.fromEntries(LEVELS.map((l) => [l, result.specs.reduce((a, s) => a + count(s, l), 0)]));
  console.log(`spec-coverage: ${result.specs.length} specs; ${LEVELS.map((l) => `${l} ${tot[l]}`).join(', ')}`);
  if (process.argv.includes('--strict') && uncovered > 0) { console.error(`spec-coverage: ${uncovered} UNCOVERED scenario(s)`); process.exit(1); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
