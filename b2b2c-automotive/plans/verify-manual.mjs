#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Validates plans/TODO-MANUAL-TESTING.md (the owner's manual rows). No dependencies.
//   node plans/verify-manual.mjs               structure + closure: exit 1 on a structural error OR any open row (gate G11)
//   node plans/verify-manual.mjs --structure   structure only: exit 1 on a structural error; open rows are reported, not failed
//   node plans/verify-manual.mjs --list        also print every open row (id, owner, status, blocker)
//
// Structure checks: row ids are unique and shaped OA-nn / SO-nn / M-X-n; every table has the required columns in
// order (ID, Workstream, Who, When, Exact steps, Expected result, Status); every row has that many cells (an unescaped
// "|" inside a cell breaks the table: write "\|"); the status is a recognised value; a WAIVED status carries a date and
// a reason; every OA/SO/M id named in a workstream file or in DEPENDENCY-PLAN.md has a row.
// Status values: TODO, IN-PROGRESS, BLOCKED (open); DONE, PASS, ACCEPTED, WAIVED, N/A (closed).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_COLUMNS = ['ID', 'Workstream', 'Who', 'When (blocks)', 'Exact steps', 'Expected result', 'Status'];
export const ID_RE = /^(?:OA|SO|M)-[A-Z0-9-]+$/;
const CLOSED = new Set(['DONE', 'PASS', 'ACCEPTED', 'WAIVED', 'N/A']);
const OPEN = new Set(['TODO', 'IN-PROGRESS', 'BLOCKED']);

/** Splits a markdown table row on unescaped pipes. */
export function splitRow(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '\\' && line[i + 1] === '|') { cur += '\\|'; i += 1; continue; }
    if (line[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += line[i];
  }
  cells.push(cur.trim());
  return cells.slice(1, -1); // the line starts and ends with a pipe
}

/** Classifies a status cell: { state: 'closed'|'open'|'unknown', word, problem? }. */
export function classifyStatus(raw) {
  const text = raw.replace(/\*\*/g, '').trim();
  if (/^N\/A\b/i.test(text)) return { state: 'closed', word: 'N/A' };
  const word = (text.match(/^[A-Za-z][A-Za-z-]*/)?.[0] ?? '').toUpperCase();
  if (word === 'WAIVED') {
    const date = /\b\d{4}-\d{2}-\d{2}\b/.test(text);
    const rest = text.replace(/^WAIVED/i, '').replace(/\b\d{4}-\d{2}-\d{2}\b/, '').replace(/[()[\]:,.-]|\bby\b/gi, ' ').trim();
    if (!date) return { state: 'closed', word, problem: 'WAIVED without a date (use "WAIVED by <name> <yyyy-mm-dd>: <reason>")' };
    if (!rest) return { state: 'closed', word, problem: 'WAIVED without a name or reason' };
    return { state: 'closed', word };
  }
  if (CLOSED.has(word)) return { state: 'closed', word };
  if (OPEN.has(word)) return { state: 'open', word };
  return { state: 'unknown', word: word || '(empty)' };
}

export function ownerOf(who) {
  const owner = /\bowner\b/i.test(who);
  const claude = /\bclaude\b/i.test(who);
  if (owner && claude) return 'owner+claude';
  if (claude) return 'claude';
  if (owner) return 'owner';
  return 'owner'; // any other human (native speaker, security-minded reviewer, developer) is an owner-side action
}

/** Parses sections 1-3 of the file (everything before "## 4."). */
export function parseManual(text) {
  const rows = [];
  const errors = [];
  const lines = text.split('\n');
  let header = null;
  for (let n = 0; n < lines.length; n += 1) {
    const line = lines[n];
    if (/^## 4\./.test(line)) break;
    if (!line.startsWith('|')) continue;
    const cells = splitRow(line);
    if (cells[0] === 'ID') {
      header = cells;
      if (REQUIRED_COLUMNS.some((c, i) => cells[i] !== c)) errors.push(`line ${n + 1}: table header must be ${REQUIRED_COLUMNS.join(' | ')} (found ${cells.join(' | ')})`);
      continue;
    }
    if (!/^(OA|SO|M)-/.test(cells[0] ?? '')) continue;
    const id = cells[0];
    if (!ID_RE.test(id)) errors.push(`line ${n + 1}: malformed row id "${id}"`);
    if (header && cells.length !== header.length) errors.push(`line ${n + 1}: ${id} has ${cells.length} cells, the table has ${header.length} columns (an unescaped "|" in a cell? write "\\|")`);
    rows.push({ id, line: n + 1, who: cells[2] ?? '', when: cells[3] ?? '', status: cells[cells.length - 1] ?? '' });
  }
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.id)) errors.push(`line ${r.line}: duplicate id ${r.id} (first on line ${seen.get(r.id)})`);
    else seen.set(r.id, r.line);
    const s = classifyStatus(r.status);
    r.state = s.state;
    r.word = s.word;
    if (s.state === 'unknown') errors.push(`line ${r.line}: ${r.id} has an unrecognised status "${r.status.slice(0, 50)}" (start it with TODO, IN-PROGRESS, BLOCKED, DONE, PASS, ACCEPTED, WAIVED or N/A)`);
    if (s.problem) errors.push(`line ${r.line}: ${r.id}: ${s.problem}`);
  }
  return { rows, errors };
}

/** Ids named in text that look like manual rows. */
export function referencedIds(text) {
  return new Set(text.match(/\b(?:OA-\d\d|SO-\d\d|M-[A-Z]-\d+[A-Za-z]?)\b/g) ?? []);
}

export function summarize(rows) {
  const open = rows.filter((r) => r.state !== 'closed');
  const by = (f) => open.reduce((m, r) => m.set(f(r), (m.get(f(r)) ?? 0) + 1), new Map());
  return { total: rows.length, closed: rows.length - open.length, open, byOwner: by((r) => ownerOf(r.who)), byBlocker: by((r) => r.when.replace(/\s+/g, ' ').slice(0, 60)) };
}

/** Ids named in the given texts that have no row (and are not old names in the mapping section). */
export function findUnmerged(rows, mappingText, sources) {
  const ids = new Set(rows.map((r) => r.id));
  const out = new Map();
  for (const [name, text] of sources) {
    for (const id of referencedIds(text)) {
      if (!ids.has(id) && !mappingText.includes(id)) out.set(id, [...(out.get(id) ?? []), name]);
    }
  }
  return out;
}

function main() {
  const PLANS = path.dirname(fileURLToPath(import.meta.url));
  const structureOnly = process.argv.includes('--structure');
  const list = process.argv.includes('--list');
  const text = readFileSync(path.join(PLANS, 'TODO-MANUAL-TESTING.md'), 'utf8');
  const { rows, errors } = parseManual(text);
  const dir = path.join(PLANS, 'workstreams');
  const sources = existsSync(dir) ? readdirSync(dir).filter((f) => /^[A-Z]-.+\.md$/.test(f)).map((f) => [`workstreams/${f}`, readFileSync(path.join(dir, f), 'utf8')]) : [];
  sources.push(['DEPENDENCY-PLAN.md', readFileSync(path.join(PLANS, 'DEPENDENCY-PLAN.md'), 'utf8')]);
  const unmerged = findUnmerged(rows, text.split(/^## 4\./m)[1] ?? '', sources);
  for (const [id, where] of unmerged) errors.push(`${id} is named in ${where.slice(0, 3).join(', ')}${where.length > 3 ? ', ...' : ''} but has no row in TODO-MANUAL-TESTING.md`);

  const s = summarize(rows);
  console.log(`manual rows: ${s.total} (closed ${s.closed}, open ${s.open.length})`);
  console.log('open by owner:');
  for (const [k, v] of [...s.byOwner].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log('open by blocker ("When" column, top 12):');
  for (const [k, v] of [...s.byBlocker].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  if (list) for (const r of s.open) console.log(`  OPEN ${r.id.padEnd(8)} ${ownerOf(r.who).padEnd(13)} ${r.word.padEnd(11)} ${r.when.slice(0, 60)}`);
  if (errors.length) console.error(errors.map((e) => `ERROR ${e}`).join('\n'));
  const failed = errors.length > 0 || (!structureOnly && s.open.length > 0);
  console.log(`verify-manual: ${failed ? 'FAILED' : 'OK'} (${errors.length} structural error${errors.length === 1 ? '' : 's'}, ${s.open.length} open${structureOnly ? '; open rows are not failed in --structure mode' : ''})`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
