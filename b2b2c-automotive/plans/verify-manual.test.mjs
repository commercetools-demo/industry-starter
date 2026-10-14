// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Run: node --test plans/
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStatus, findUnmerged, ownerOf, parseManual, summarize } from './verify-manual.mjs';

const HEAD = '| ID | Workstream | Who | When (blocks) | Exact steps | Expected result | Status |\n| --- | --- | --- | --- | --- | --- | --- |\n';
const row = (id, status, who = 'Owner') => `| ${id} | A | ${who} | After X | do it | done | ${status} |\n`;

test('verify-manual accepts closed rows', () => {
  for (const s of ['DONE', 'PASS', 'done', 'ACCEPTED by the owner 2026-10-12', 'WAIVED by Ana 2026-10-12: not needed', 'N/A']) {
    assert.equal(classifyStatus(s).state, 'closed', s);
    assert.equal(classifyStatus(s).problem, undefined, s);
  }
  const { rows, errors } = parseManual(HEAD + row('OA-01', 'DONE') + row('M-A-1', 'PASS'));
  assert.deepEqual(errors, []);
  assert.equal(summarize(rows).open.length, 0);
});

test('verify-manual rejects open, unknown and malformed WAIVED rows', () => {
  assert.equal(classifyStatus('TODO').state, 'open');
  assert.equal(classifyStatus('BLOCKED (waiting)').state, 'open');
  assert.equal(classifyStatus('maybe later').state, 'unknown');
  assert.match(classifyStatus('WAIVED by Ana: no date').problem, /date/);
  assert.match(classifyStatus('WAIVED 2026-10-12').problem, /name or reason/);
  const { errors } = parseManual(HEAD + row('OA-01', 'WAIVED 2026-10-12') + row('OA-02', 'soon'));
  assert.equal(errors.length, 2);
});

test('verify-manual checks ids, columns and cell counts', () => {
  const dup = parseManual(HEAD + row('OA-01', 'TODO') + row('OA-01', 'TODO'));
  assert.ok(dup.errors.some((e) => /duplicate id OA-01/.test(e)));
  const bad = parseManual('| ID | Who | Status |\n| - | - | - |\n| OA-01 | Owner | TODO |\n');
  assert.ok(bad.errors.some((e) => /table header must be/.test(e)));
  const pipe = parseManual(HEAD + '| OA-01 | A | Owner | X | a|b | ok | TODO |\n');
  assert.ok(pipe.errors.some((e) => /cells/.test(e)));
  const escaped = parseManual(HEAD + '| OA-01 | A | Owner | X | a\\|b | ok | TODO |\n');
  assert.deepEqual(escaped.errors, []);
});

test('verify-manual stops at the mapping section and counts open rows per owner', () => {
  const { rows } = parseManual(HEAD + row('OA-01', 'TODO') + row('M-B-1', 'TODO', 'Claude after OA-01') + row('M-C-1', 'TODO', 'Owner and Claude') + '\n## 4. Mapping\n| OA-X (A) | OA-01 | n |\n');
  assert.equal(rows.length, 3);
  const s = summarize(rows);
  assert.equal(s.byOwner.get('owner'), 1);
  assert.equal(s.byOwner.get('claude'), 1);
  assert.equal(s.byOwner.get('owner+claude'), 1);
  assert.equal(ownerOf('Native speaker'), 'owner');
});

test('verify-manual catches unmerged rows', () => {
  const { rows } = parseManual(HEAD + row('OA-01', 'TODO'));
  const unmerged = findUnmerged(rows, 'old name OA-09', [['workstreams/V-x.md', 'needs OA-01, OA-02 and M-V-05 and OA-09']]);
  assert.deepEqual([...unmerged.keys()].sort(), ['M-V-05', 'OA-02']);
});
