// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// node plans/verify-plan.mjs [--strict]
//
// Checks that the plan is consistent with the specs:
//  1. DEPENDENCY-PLAN: letters ascend, every dependency is an earlier letter, a workstream file exists per letter.
//  2. SPEC-COVERAGE: every spec directory is listed exactly once, nothing listed is missing on disk.
//  3. The first workstream (by letter) that lists a spec in DEPENDENCY-PLAN is that spec's primary in SPEC-COVERAGE.
//  4. --strict: every workstream file has the required headings and every task has a checkbox.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plans = join(root, 'plans');
const specsDir = join(root, 'openspec', 'specs');
const strict = process.argv.includes('--strict');
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

if (errors.length) {
  console.error(`plan check failed (${errors.length}):`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`plan ok: ${letters.length} workstreams, ${covered.size} specs${strict ? ', strict' : ''}`);
