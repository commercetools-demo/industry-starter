// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// node plans/verify-plan.mjs [--strict] [--scenarios] [--ticks] [--tests <vitest.json>] [--manual] [--questions] [--release] [--root <dir>]
//
// Checks that the plan is consistent with the specs:
//  1. DEPENDENCY-PLAN: letters ascend, every dependency is an earlier letter, a workstream file exists per letter.
//  2. SPEC-COVERAGE: every spec directory is listed exactly once, nothing listed is missing on disk.
//  3. The first workstream (by letter) that lists a spec in DEPENDENCY-PLAN is that spec's primary in SPEC-COVERAGE.
//  4. --strict: every workstream file has the required headings and every task has a checkbox.
//  5. --scenarios: every `#### Scenario:` of an applicable spec is named in its primary workstream's Scenarios checklist or in the
//     "Scenario map" table of SPEC-COVERAGE.md; prints UNCOVERED rows and writes evidence/Q/spec-coverage.md.
//     --ticks: a ticked checklist line must name a test (backticks). --tests <file>: quoted test titles must exist and have passed
//     in the Vitest JSON report (MISSING TEST, FAILED TEST).
//  6. --manual: TODO-MANUAL-TESTING.md rows are well formed (six columns, unique well-formed ids, known status, steps and result).
//  7. --questions: every Q-<letter>-<n> named in a workstream file exists in QUESTIONS.md or notes/questions-*.md.
//  8. --release: every workstream Done in STATUS.md, no owner row TODO or FAIL, no UNCOVERED or BLOCKED scenario.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { coverageOf, listWsFile, norm, quoted, testsIn } from './spec-ledger.mjs';

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const root = argOf('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const plans = join(root, 'plans');
const specsDir = join(root, 'openspec', 'specs');
const strict = argv.includes('--strict');
const errors = [];
const err = (m) => errors.push(m);

function tableRows(md, headerStart) {
  const lines = md.split('\n');
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('|') && line.includes(headerStart)) { inTable = true; continue; }
    if (inTable) {
      if (!line.startsWith('|')) { inTable = false; continue; }
      if (/^\|\s*-/.test(line)) continue;
      rows.push(line.split('|').slice(1, -1).map((c) => c.trim()));
    }
  }
  return rows;
}
const stripParens = (s) => s.replace(/\([^)]*\)/g, '').trim();
const splitList = (s) => stripParens(s).split(',').map((x) => x.trim()).filter(Boolean);

// 1. dependency plan
const dep = readFileSync(join(plans, 'DEPENDENCY-PLAN.md'), 'utf8');
const wsRows = tableRows(dep, '| ID | Workstream');
const letters = wsRows.map((r) => r[0]);
const firstListing = new Map();
let prev = '';
for (const r of wsRows) {
  const [id, , implCell, depCell] = r;
  if (prev && id <= prev) err(`workstream ${id} is not after ${prev}`);
  prev = id;
  const deps = /^none$/i.test(depCell) ? [] : depCell.split(',').map((x) => x.trim()).filter(Boolean);
  for (const d of deps) {
    if (!letters.includes(d) && d !== 'all') err(`${id} depends on unknown ${d}`);
    else if (d !== 'all' && d >= id) err(`${id} depends on later or same letter ${d}`);
  }
  for (const spec of splitList(implCell)) {
    if (/^none/.test(spec)) continue;
    if (!firstListing.has(spec)) firstListing.set(spec, id);
  }
  const wsDir = join(plans, 'workstreams');
  const found = existsSync(wsDir) && readdirSync(wsDir).some((f) => f.startsWith(id + '-'));
  if (!found) err(`no workstream file plans/workstreams/${id}-*.md`);
}

// 2 + 3. coverage
const cov = readFileSync(join(plans, 'SPEC-COVERAGE.md'), 'utf8');
const covRows = [...tableRows(cov, '| Spec | Primary | Also'), ...tableRows(cov, '| Spec | Primary | Note')];
const covered = new Map();
for (const [spec, primary] of covRows) {
  if (covered.has(spec)) err(`spec ${spec} listed twice in SPEC-COVERAGE`);
  covered.set(spec, primary);
}
const onDisk = readdirSync(specsDir).filter((d) => statSync(join(specsDir, d)).isDirectory() && existsSync(join(specsDir, d, 'spec.md')));
for (const s of onDisk) if (!covered.has(s)) err(`spec ${s} is on disk but not in SPEC-COVERAGE`);
for (const s of covered.keys()) if (!onDisk.includes(s)) err(`spec ${s} is in SPEC-COVERAGE but not on disk`);
for (const [spec, primary] of covered) {
  if (primary === 'n/a') continue;
  if (!letters.includes(primary)) err(`spec ${spec} primary ${primary} is not a workstream`);
  const first = firstListing.get(spec);
  if (!first) err(`spec ${spec} (primary ${primary}) is not listed in DEPENDENCY-PLAN`);
  else if (first !== primary) err(`spec ${spec}: first listed in ${first} but primary is ${primary}`);
}
for (const spec of firstListing.keys()) if (!covered.has(spec)) err(`DEPENDENCY-PLAN lists unknown spec ${spec}`);

// 4. strict workstream checks
if (strict) {
  const headings = ['Goal and scope', 'Design', 'Tasks', 'Scenarios checklist', 'Browser recipe', 'Self-verification', 'Manual testing', 'Questions', 'Definition of done'];
  const wsDir = join(plans, 'workstreams');
  for (const id of letters) {
    const f = existsSync(wsDir) && readdirSync(wsDir).find((x) => x.startsWith(id + '-'));
    if (!f) continue;
    const md = readFileSync(join(wsDir, f), 'utf8');
    for (const h of headings) if (!new RegExp('^#{1,3}\\s+(\\d+\\.\\s*)?' + h, 'mi').test(md)) err(`${f}: missing heading "${h}"`);
    const tasks = md.match(new RegExp('^\\s*-\\s+\\[[ x]\\]\\s+\\*{0,2}' + id + '-\\d+', 'gm')) || [];
    if (tasks.length === 0) err(`${f}: no tasks like "- [ ] ${id}-01"`);
  }
}

// 5. scenario ledger
const wantScenarios = argv.includes('--scenarios') || argv.includes('--ticks') || argv.includes('--tests') || argv.includes('--release');
const report = [];
let open = 0;
if (wantScenarios) {
  const mapRows = tableRows(cov, '| Spec | Scenario | Evidence');
  const map = new Map(mapRows.map(([spec, scenario, evidence]) => [`${spec}::${norm(scenario)}`, evidence]));
  const wsFile = listWsFile(plans);
  const rows = coverageOf({ root, covered, wsFile });
  const vitest = argOf('--tests')
    ? new Map(argOf('--tests').split(',').flatMap((f) => [...testsIn(JSON.parse(readFileSync(f, 'utf8'))).entries()]))
    : null;
  const unverified = [];
  const known = (phrase) => vitest && [...vitest.entries()].some(([t, st]) => t.includes(phrase) && st === 'passed');
  const failed = (phrase) => vitest && [...vitest.entries()].some(([t, st]) => t.includes(phrase) && st === 'failed') && !known(phrase);
  for (const r of rows) {
    const mapped = map.get(`${r.spec}::${norm(r.title)}`);
    let status = 'covered';
    let evidence = r.line.trim().replace(/^-\s*\[[ x]\]\s*/, '');
    if (!r.covered && !mapped) { status = 'UNCOVERED'; err(`UNCOVERED ${r.spec} / ${r.title}`); }
    else if (!r.covered && mapped) {
      evidence = mapped;
      if (/^blocked/i.test(mapped)) { status = 'BLOCKED'; open += 1; }
      else if (/^n\/a/i.test(mapped)) status = 'n/a';
    } else if (argv.includes('--ticks') && r.ticked && quoted(r.line).length === 0 && !/`/.test(r.line)) {
      err(`ticked scenario without a test: ${r.spec} / ${r.title}`);
    } else if (!r.ticked) { status = 'UNTICKED'; }
    if (vitest && status !== 'UNCOVERED') {
      for (const phrase of quoted(mapped && !r.covered ? mapped : r.line)) {
        if (/^(G|H|I|J|K|L|M|N|O|P|Q|A|B|C|D|E|F)-\d+/.test(phrase) || /\.(ts|tsx|mjs)\b/.test(phrase)) continue;
        if (failed(phrase)) err(`FAILED TEST ${r.spec} / ${r.title}: ${phrase}`);
        else if (!known(phrase.replace(/\.\.\.$/, '')) && r.covered) unverified.push(`${r.spec} / ${r.title}: ${phrase}`);
      }
      if (mapped && !r.covered && !/^(n\/a|blocked)/i.test(mapped)) {
        const title = (/`([^`]+)`/.exec(mapped) ?? [])[1];
        if (!title || !known(title)) err(`MISSING TEST ${r.spec} / ${r.title}: ${title ?? mapped}`);
      }
    }
    report.push({ ...r, status, evidence });
  }
  if (unverified.length) console.log(`note: ${unverified.length} quoted reference(s) in ticked lines are not titles of a test in the report (commands, other packages or paraphrases):\n  ` + unverified.join('\n  '));
  const outDir = join(plans, 'evidence', 'Q');
  if (argv.includes('--scenarios') && existsSync(outDir)) {
    const lines = ['<!-- SPDX-License-Identifier: MIT -->', '<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->', '',
      '# Scenario ledger (generated by `node plans/verify-plan.mjs --scenarios`)', '',
      `Scenarios on disk (applicable specs): ${report.length}. Covered: ${report.filter((r) => ['covered', 'UNTICKED', 'n/a'].includes(r.status)).length}. Blocked on an owner row: ${report.filter((r) => r.status === 'BLOCKED').length}. Uncovered: ${report.filter((r) => r.status === 'UNCOVERED').length}.`, '',
      '| Spec | Primary | Scenario | Status | Evidence |', '| --- | --- | --- | --- | --- |',
      ...report.map((r) => `| ${r.spec} | ${r.primary} | ${r.title} | ${r.status} | ${r.evidence.replace(/\|/g, '/').slice(0, 160)} |`)];
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'spec-coverage.md'), lines.join('\n') + '\n');
  }
}

// 6. owner rows
const todoFile = join(plans, 'TODO-MANUAL-TESTING.md');
const wantManual = argv.includes('--manual') || argv.includes('--release');
if (wantManual && existsSync(todoFile)) {
  const STATUSES = ['TODO', 'DONE', 'PASS', 'FAIL', 'WAIVED'];
  const idRe = /^(OA-[A-Za-z0-9]+(-[A-Za-z0-9]+)?|SO-[A-Za-z0-9]+(-[A-Za-z0-9]+)?|M-[A-Z]-\d+)$/;
  const seen = new Map();
  const unnumbered = [];
  for (const line of readFileSync(todoFile, 'utf8').split('\n')) {
    if (!/^\|\s*(OA|SO|M)-/.test(line)) continue;
    const cells = line.replace(/\\\|/g, '\u0001').split('|').slice(1, -1).map((c) => c.trim().replace(/\u0001/g, '|'));
    const [rawId, who, when, steps, expected, status] = cells;
    const id = (rawId ?? '').replace(/\s*\(.*\)\s*$/, '');
    if (cells.length !== 6) { err(`owner row ${id}: ${cells.length} columns, expected 6`); continue; }
    if (!idRe.test(id)) err(`owner row id not well formed: ${id}`);
    // `OA-x`, `SO-x1`: placeholders the workstreams wrote before the lead numbers them. Reported, not failed, until --release.
    const placeholder = /^(OA|SO)-x\d*(\s|$)/.test(rawId);
    if (placeholder) { unnumbered.push(rawId); if (argv.includes('--release')) err(`owner row ${rawId} has no number yet`); }
    else if (seen.has(rawId)) err(`duplicate owner row id ${rawId}`); else seen.set(rawId, status);
    if (!who || !when || !steps || !expected) err(`owner row ${id}: who, when, steps and expected result must not be empty`);
    const state = status.split(/[ (]/)[0];
    if (!STATUSES.includes(state)) err(`owner row ${id}: status "${status}" is not one of ${STATUSES.join(', ')}`);
    if (argv.includes('--release') && ['TODO', 'FAIL'].includes(state)) { open += 1; err(`owner row ${id} is ${state}`); }
  }
  if (unnumbered.length) console.log(`note: ${unnumbered.length} owner row(s) still carry a placeholder id (the lead numbers them): ${unnumbered.join(', ')}`);
}

// 7. questions
if (argv.includes('--questions')) {
  const sources = [join(plans, 'QUESTIONS.md'), ...(existsSync(join(plans, 'notes')) ? readdirSync(join(plans, 'notes')).filter((f) => f.startsWith('questions-')).map((f) => join(plans, 'notes', f)) : [])];
  const qnorm = (q) => q.replace(/-0+(\d)/g, '-$1');
  const known = new Set(sources.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bQ-(?:[A-Z]-\d+|\d+)\b/g)].map((m) => qnorm(m[0]))));
  const wsDir = join(plans, 'workstreams');
  for (const f of existsSync(wsDir) ? readdirSync(wsDir) : []) {
    for (const m of readFileSync(join(wsDir, f), 'utf8').matchAll(/\bQ-[A-Z]-\d+\b/g)) if (!known.has(qnorm(m[0]))) err(`${f}: ${m[0]} is named but not in QUESTIONS.md or notes/questions-*.md`);
  }
}

// 8. release: every workstream Done
if (argv.includes('--release')) {
  const status = join(plans, 'STATUS.md');
  if (existsSync(status)) {
    for (const r of tableRows(readFileSync(status, 'utf8'), '| ID | Workstream')) if (!/^Done/.test(r[3])) err(`workstream ${r[0]} is "${r[3]}", not Done`);
  }
  if (open > 0) err(`${open} scenario or owner row open`);
}

if (errors.length) {
  console.error(`plan check failed (${errors.length}):`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`plan ok: ${letters.length} workstreams, ${covered.size} specs${strict ? ', strict' : ''}`);
