// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// node plans/consolidate-notes.mjs
// Folds plans/notes/questions-*.md into the generated block of QUESTIONS.md and plans/notes/todo-*.md into the
// generated blocks of TODO-MANUAL-TESTING.md (OA, SO, M tables). Safe to re-run: only the text between the
// BEGIN/END markers is replaced. Rows keep their ids (workstream placeholders like OA-K-a are valid unique ids).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plans = dirname(fileURLToPath(import.meta.url));
const notes = join(plans, 'notes');

function rowsOf(file) {
  const out = [];
  for (const line of readFileSync(join(notes, file), 'utf8').split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells[0] === 'ID' || cells[0] === '') continue;
    out.push(cells);
  }
  return out;
}
function replaceBlock(md, name, body) {
  const b = `<!-- BEGIN ${name} -->`;
  const e = `<!-- END ${name} -->`;
  const i = md.indexOf(b);
  const j = md.indexOf(e);
  if (i < 0 || j < 0) throw new Error(`markers for ${name} not found`);
  return md.slice(0, i + b.length) + '\n' + body + '\n' + md.slice(j);
}

const files = readdirSync(notes).sort();

// questions
const qFiles = files.filter((f) => /^questions-.*\.md$/.test(f));
let q = '| ID | Question | Default being built | Blocks | Status | Answer |\n| --- | --- | --- | --- | --- | --- |\n';
let qn = 0;
for (const f of qFiles) {
  for (const c of rowsOf(f)) {
    if (c.length < 4) continue;
    const [id, question, def, blocks, status = 'Open'] = c;
    q += `| ${id} | ${question} | ${def} | ${blocks} | ${status} | |\n`;
    qn += 1;
  }
}
const qPath = join(plans, 'QUESTIONS.md');
writeFileSync(qPath, replaceBlock(readFileSync(qPath, 'utf8'), 'WORKSTREAM-QUESTIONS', q.trimEnd()));

// todo rows
const tFiles = files.filter((f) => /^todo-.*\.md$/.test(f));
const buckets = { OA: [], SO: [], M: [] };
for (const f of tFiles) {
  for (const c of rowsOf(f)) {
    if (c.length < 6) continue;
    const kind = c[0].startsWith('OA') ? 'OA' : c[0].startsWith('SO') ? 'SO' : c[0].startsWith('M') ? 'M' : null;
    if (kind) buckets[kind].push(c);
  }
}
const head = '| ID | Who | When needed | Steps | Expected result | Status |\n| --- | --- | --- | --- | --- | --- |\n';
const tPath = join(plans, 'TODO-MANUAL-TESTING.md');
let t = readFileSync(tPath, 'utf8');
for (const kind of ['OA', 'SO', 'M']) {
  const body = head + buckets[kind].map((c) => `| ${c.slice(0, 6).join(' | ')} |`).join('\n');
  t = replaceBlock(t, `WORKSTREAM-${kind}`, body);
}
writeFileSync(tPath, t);
console.log(`questions: ${qn} from ${qFiles.length} files; todo rows: OA ${buckets.OA.length}, SO ${buckets.SO.length}, M ${buckets.M.length}`);
