#!/usr/bin/env node
// Verifies the implementation plan. Run from anywhere:
//   node plans/verify-plan.mjs          check only (exit 1 on any error)
//   node plans/verify-plan.mjs --sync   first regenerate: scenario checklists in workstream files,
//                                        the dependency graph, and the STATUS table; then check
// No dependencies. Reads openspec/ specs, plans/DEPENDENCY-PLAN.md, plans/workstreams/*.md,
// plans/QUESTIONS.md, plans/TODO-MANUAL-TESTING.md, plans/STATUS.md.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PLANS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(PLANS);
const SYNC = process.argv.includes('--sync');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Specs deliberately not built (owner decision), with the reason. */
const OMITTED = { 'password-reset': 'Q-070: no reset UI (no email provider)' };
const SKILLS = new Set(['commercetools-platform', 'commercetools-storefront', 'commercetools-commerce-patterns', 'commercetools-checkout', 'commercetools-connect', 'commercetools-integrations', 'commercetools-catalog-migration']);
const SECTIONS = ['## Design', '## Tasks', '## Scenarios', '## Browser recipe', '## Manual tests', '## Definition of done'];

const errors = [];
const err = (m) => errors.push(m);
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);

// ---------- specs ----------
function parseSpec(file) {
  const reqs = [];
  for (const line of read(file).split('\n')) {
    let m;
    if ((m = line.match(/^### Requirement: (.+?)\s*$/))) reqs.push({ title: m[1], scenarios: [] });
    else if ((m = line.match(/^#### Scenario: (.+?)\s*$/)) && reqs.length) reqs.at(-1).scenarios.push(m[1]);
  }
  return reqs;
}
const specs = {};
for (const base of [path.join(ROOT, 'openspec/specs'), path.join(ROOT, 'openspec/changes/bootstrap-storefront/specs')]) {
  if (!existsSync(base)) continue;
  for (const d of readdirSync(base, { withFileTypes: true })) {
    const f = path.join(base, d.name, 'spec.md');
    if (d.isDirectory() && existsSync(f)) specs[d.name] = parseSpec(f);
  }
}

// ---------- dependency table ----------
const planText = read(path.join(PLANS, 'DEPENDENCY-PLAN.md'));
const expand = (s) => {
  const out = new Set();
  for (const part of s.replace(/\*|`|\(.*?\)/g, '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const r = part.match(/^([A-Z])\s*[–-]\s*([A-Z])$/);
    if (r) for (let c = r[1].charCodeAt(0); c <= r[2].charCodeAt(0); c++) out.add(String.fromCharCode(c));
    else if (/^[A-Z]$/.test(part)) out.add(part);
  }
  return out;
};
const table = {};
for (const line of planText.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length > 6 && /^[A-Z]$/.test(cells[1])) table[cells[1]] = { name: cells[2], deps: expand(cells[4]) };
}
for (const L of LETTERS) if (!table[L]) err(`DEPENDENCY-PLAN.md: no table row for workstream ${L}`);
for (const [L, row] of Object.entries(table)) for (const d of row.deps) if (d >= L) err(`DEPENDENCY-PLAN.md: ${L} depends on ${d}, which is not an earlier letter`);

// ---------- workstream files ----------
const wsDir = path.join(PLANS, 'workstreams');
const files = existsSync(wsDir) ? readdirSync(wsDir).filter((f) => /^[A-Z]-.+\.md$/.test(f)) : [];
const ws = {};
for (const f of files) ws[f[0]] = { file: path.join(wsDir, f), text: read(path.join(wsDir, f)) };
for (const L of LETTERS) if (!ws[L]) err(`workstreams/: missing file for ${L}`);

function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseImplements(text) {
  const m = text.match(/^\*\*Implements:\*\*\s*(.+)$/m);
  if (!m) return null;
  if (/^\(none/i.test(m[1])) return [];
  return splitTop(m[1].replace(/`/g, '')).map((e) => {
    const x = e.match(/^([a-z0-9-]+)(?:\[(.+)\])?$/);
    if (!x) return { bad: e };
    let only = null, except = null;
    if (x[2]) {
      const list = x[2].split(';').map((s) => s.trim());
      if (x[2].trim().startsWith('-')) except = list.map((s) => s.replace(/^-\s*/, ''));
      else only = list;
    }
    return { name: x[1], only, except };
  });
}
const coveredReq = {}; // spec -> Set(requirement titles)
const generated = {}; // L -> generated scenario block text
for (const L of LETTERS) {
  const w = ws[L]; if (!w) continue;
  const where = `workstreams/${path.basename(w.file)}`;
  for (const s of SECTIONS) if (!w.text.includes(`\n${s}`)) err(`${where}: missing section "${s}"`);
  if (!new RegExp(`^# Workstream ${L}\\b`, 'm').test(w.text)) err(`${where}: title must start "# Workstream ${L}"`);
  // depends
  const dm = w.text.match(/^\*\*Depends on:\*\*\s*(.+)$/m);
  if (!dm) err(`${where}: missing "**Depends on:**"`);
  else {
    const have = expand(dm[1]), want = table[L]?.deps ?? new Set();
    if ([...have].sort().join() !== [...want].sort().join()) err(`${where}: Depends on {${[...have].sort()}} != DEPENDENCY-PLAN {${[...want].sort()}}`);
  }
  // implements
  const impl = parseImplements(w.text);
  if (impl === null) { err(`${where}: missing "**Implements:**"`); continue; }
  const blocks = [];
  for (const e of impl) {
    if (e.bad) { err(`${where}: cannot parse Implements entry "${e.bad}"`); continue; }
    if (!specs[e.name]) { err(`${where}: unknown spec "${e.name}"`); continue; }
    for (const r of [...(e.only ?? []), ...(e.except ?? [])]) if (!specs[e.name].some((q) => q.title === r)) err(`${where}: spec ${e.name} has no requirement "${r}"`);
    const reqs = specs[e.name].filter((q) => (e.only ? e.only.includes(q.title) : e.except ? !e.except.includes(q.title) : true));
    (coveredReq[e.name] ??= new Set());
    for (const q of reqs) {
      coveredReq[e.name].add(q.title);
      if (q.scenarios.length) blocks.push(`#### ${e.name} › ${q.title}`, ...q.scenarios.map((s) => `- [ ] ${s}`));
    }
  }
  generated[L] = blocks;
  // tasks
  const tasks = [...w.text.matchAll(/^- \[( |x)\] ([A-Z])-(\d\d)\b(.*)$/gm)];
  if (tasks.length === 0) err(`${where}: no tasks`);
  tasks.forEach((t, i) => {
    if (t[2] !== L) err(`${where}: task id ${t[2]}-${t[3]} has the wrong letter`);
    if (Number(t[3]) !== i + 1) err(`${where}: task ids must be sequential from 01 (found ${t[2]}-${t[3]} at position ${i + 1})`);
    for (const sk of t[4].matchAll(/\[SKILL: ([^\]]+)\]/g)) if (!SKILLS.has(sk[1])) err(`${where}: ${L}-${t[3]} unknown skill ${sk[1]}`);
    for (const sp of t[4].matchAll(/\[SPEC: ([^\]]+)\]/g)) if (!impl.some((e) => e.name === sp[1])) err(`${where}: ${L}-${t[3]} tags spec ${sp[1]} not listed in Implements`);
  });
  for (const e of impl) if (e.name && !tasks.some((t) => t[4].includes(`[SPEC: ${e.name}]`))) err(`${where}: no task carries [SPEC: ${e.name}]`);
  const ctTask = tasks.filter((t) => /lib\/ct|apiRoot|commercetools/i.test(t[4]) && !/\[SKILL:/.test(t[4]));
  for (const t of ctTask) err(`${where}: ${L}-${t[3]} touches commercetools but has no [SKILL: …] (project rule)`);
  // references
  const q = read(path.join(PLANS, 'QUESTIONS.md')), todo = read(path.join(PLANS, 'TODO-MANUAL-TESTING.md'));
  for (const m of new Set(w.text.match(/\bQ-\d{3}\b/g) ?? [])) if (!q.includes(m)) err(`${where}: references unknown ${m}`);
  for (const m of new Set(w.text.match(/\b(OA|SO)-\d\d\b/g) ?? [])) if (!todo.includes(m)) err(`${where}: references unknown ${m}`);
  const manual = w.text.split('\n## Manual tests')[1]?.split('\n## ')[0] ?? '';
  for (const m of new Set(manual.match(/\bM-[A-Z]-\d+\b/g) ?? [])) if (!todo.includes(`| ${m} |`)) err(`${where}: manual test ${m} is not in TODO-MANUAL-TESTING.md`);
}

// every spec/requirement covered (or omitted with a reason)
for (const [name, reqs] of Object.entries(specs)) {
  if (OMITTED[name]) { if (coveredReq[name]) err(`spec ${name} is OMITTED (${OMITTED[name]}) but a workstream implements it`); continue; }
  if (!coveredReq[name]) { err(`spec ${name} is not implemented by any workstream`); continue; }
  for (const r of reqs) if (!coveredReq[name].has(r.title)) err(`spec ${name}: requirement "${r.title}" is not covered by any workstream`);
}
const cov = read(path.join(PLANS, 'SPEC-COVERAGE.md'));
for (const name of Object.keys(specs)) if (!cov.includes(name)) err(`SPEC-COVERAGE.md does not mention ${name}`);

// ---------- sync ----------
const BEGIN = (k) => `<!-- ${k}:BEGIN (generated by plans/verify-plan.mjs --sync) -->`;
const END = (k) => `<!-- ${k}:END -->`;
function replaceBlock(text, key, body) {
  const b = text.indexOf(BEGIN(key)), e = text.indexOf(END(key));
  if (b < 0 || e < 0) return null;
  return `${text.slice(0, b)}${BEGIN(key)}\n${body}\n${text.slice(e)}`;
}
function blockOf(text, key) {
  const b = text.indexOf(BEGIN(key)), e = text.indexOf(END(key));
  return b < 0 || e < 0 ? null : text.slice(b + BEGIN(key).length, e).replace(/^\n|\n$/g, '');
}
for (const L of LETTERS) {
  const w = ws[L]; if (!w || !generated[L]) continue;
  const where = `workstreams/${path.basename(w.file)}`;
  const old = blockOf(w.text, 'SCENARIOS');
  if (old === null) { err(`${where}: missing scenario markers (${BEGIN('SCENARIOS')} … ${END('SCENARIOS')})`); continue; }
  // keep ticks and notes of lines that still exist
  const keep = new Map(old.split('\n').filter((l) => l.startsWith('- [')).map((l) => [l.replace(/^- \[[ x]\] /, '').replace(/\s+—\s.*$/, ''), l]));
  const next = generated[L].map((l) => (l.startsWith('- [ ] ') ? keep.get(l.slice(6)) ?? l : l)).join('\n');
  if (SYNC) { w.text = replaceBlock(w.text, 'SCENARIOS', next); writeFileSync(w.file, w.text); }
  else if (old.trim() !== next.trim()) err(`${where}: scenario checklist is stale; run with --sync`);
}

// graph
const edges = [];
for (const L of LETTERS) for (const d of [...(table[L]?.deps ?? [])].sort()) edges.push(`  ${d}["${d} ${table[d]?.name ?? ''}"] --> ${L}["${L} ${table[L]?.name ?? ''}"]`.replace(/"/g, '"'));
const graph = '```mermaid\ngraph LR\n' + edges.join('\n') + '\n```';
if (blockOf(planText, 'GRAPH') === null) err('DEPENDENCY-PLAN.md: missing GRAPH markers');
else if (SYNC) writeFileSync(path.join(PLANS, 'DEPENDENCY-PLAN.md'), replaceBlock(planText, 'GRAPH', graph));
else if (blockOf(planText, 'GRAPH').trim() !== graph.trim()) err('DEPENDENCY-PLAN.md: graph is stale; run with --sync');

// status table
const statusPath = path.join(PLANS, 'STATUS.md');
let statusText = read(statusPath);
const oldStatus = blockOf(statusText, 'STATUS') ?? '';
const prev = new Map(oldStatus.split('\n').map((l) => l.split('|').map((c) => c.trim())).filter((c) => /^[A-Z]$/.test(c[1] ?? '')).map((c) => [c[1], c[5]]));
const rows = ['| WS | Name | Tasks done/total | Scenarios ticked/total | Status |', '| --- | --- | --- | --- | --- |'];
for (const L of LETTERS) {
  const t = ws[L]?.text ?? '';
  const all = [...t.matchAll(/^- \[( |x)\] [A-Z]-\d\d\b/gm)], done = all.filter((m) => m[1] === 'x').length;
  const sc = (blockOf(t, 'SCENARIOS') ?? '').split('\n').filter((l) => l.startsWith('- ['));
  rows.push(`| ${L} | ${table[L]?.name ?? ''} | ${done}/${all.length} | ${sc.filter((l) => l.startsWith('- [x]')).length}/${sc.length} | ${prev.get(L) || 'Not started'} |`);
}
const statusBody = rows.join('\n');
if (blockOf(statusText, 'STATUS') === null) err('STATUS.md: missing STATUS markers');
else if (SYNC) writeFileSync(statusPath, replaceBlock(statusText, 'STATUS', statusBody));
else if (blockOf(statusText, 'STATUS').trim() !== statusBody.trim()) err('STATUS.md: counts are stale; run with --sync');

// optional: openspec validity
const os = spawnSync('openspec', ['validate', '--all'], { cwd: ROOT, encoding: 'utf8' });
if (os.error) console.log('note: openspec CLI not found, skipped `openspec validate --all`');
else if (os.status !== 0) err(`openspec validate --all failed:\n${(os.stdout + os.stderr).trim()}`);

if (errors.length) {
  console.error(errors.map((e) => `ERROR ${e}`).join('\n'));
  console.error(`plan verification: FAILED (${errors.length} error${errors.length > 1 ? 's' : ''})`);
  process.exit(1);
}
const nTasks = LETTERS.reduce((n, L) => n + [...(ws[L]?.text ?? '').matchAll(/^- \[[ x]\] [A-Z]-\d\d\b/gm)].length, 0);
console.log(`${LETTERS.length} workstreams, ${nTasks} tasks, ${Object.keys(specs).length} specs (${Object.keys(OMITTED).length} omitted)`);
console.log('plan verification: OK');
