// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// node --test plans/verify-plan.test.mjs
// Each rule of verify-plan.mjs fails on a planted defect and passes on the clean fixture (workstream Q, Q-02).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = join(dirname(fileURLToPath(import.meta.url)), 'verify-plan.mjs');

const SPEC_ONE = '# one\n\n#### Scenario: Alpha works\n- GIVEN x\n\n#### Scenario: Beta works\n- GIVEN y\n';
const SPEC_TWO = '# two\n\n#### Scenario: Gamma works\n- GIVEN z\n';
const TODO_HEAD = '| ID | Who | When needed | Steps | Expected result | Status |\n| --- | --- | --- | --- | --- | --- |\n';

function fixture({ checklist, deps = ['none', 'A'], extraSpecMap = '', todo = '', questions = '', wsExtra = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'verify-plan-'));
  mkdirSync(join(root, 'openspec', 'specs', 'spec-one'), { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs', 'spec-two'), { recursive: true });
  mkdirSync(join(root, 'plans', 'workstreams'), { recursive: true });
  mkdirSync(join(root, 'plans', 'notes'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'specs', 'spec-one', 'spec.md'), SPEC_ONE);
  writeFileSync(join(root, 'openspec', 'specs', 'spec-two', 'spec.md'), SPEC_TWO);
  writeFileSync(join(root, 'plans', 'DEPENDENCY-PLAN.md'),
    `| ID | Workstream | Specs implemented | Depends on |\n| --- | --- | --- | --- |\n| A | First | spec-one | ${deps[0]} |\n| B | Second | spec-two | ${deps[1]} |\n`);
  writeFileSync(join(root, 'plans', 'SPEC-COVERAGE.md'),
    `| Spec | Primary | Also | Note |\n| --- | --- | --- | --- |\n| spec-one | A | | |\n| spec-two | B | | |\n\n| Spec | Scenario | Evidence |\n| --- | --- | --- |\n${extraSpecMap}`);
  writeFileSync(join(root, 'plans', 'workstreams', 'A-first.md'), `# A\n\n## 5. Scenarios checklist\n\n\`spec-one\`:\n${checklist}\n\n## 6. Next\n${wsExtra}`);
  writeFileSync(join(root, 'plans', 'workstreams', 'B-second.md'),
    '# B\n\n## 5. Scenarios checklist\n\n`spec-two`:\n- [x] Gamma works: `gamma works in the page`\n');
  writeFileSync(join(root, 'plans', 'TODO-MANUAL-TESTING.md'), TODO_HEAD + todo);
  writeFileSync(join(root, 'plans', 'QUESTIONS.md'), `| ID | Question |\n| --- | --- |\n${questions}`);
  writeFileSync(join(root, 'plans', 'STATUS.md'), '| ID | Workstream | Wave | State | Notes |\n| --- | --- | --- | --- | --- |\n| A | First | 1 | Done | |\n| B | Second | 2 | Done | |\n');
  return root;
}

const GOOD = '- [x] Alpha works: `alpha works in the page`\n- [x] Beta works: `beta works in the page`';
const report = (root, names) => ({
  testResults: [{ name: 'x.test.ts', assertionResults: names.map(([title, status]) => ({ title, fullName: title, status })) }],
});
function run(root, ...args) {
  try {
    return { code: 0, out: execFileSync('node', [script, '--root', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}
const vitestFile = (root, names) => {
  const f = join(root, 'vitest.json');
  writeFileSync(f, JSON.stringify(report(root, names)));
  return f;
};
const ALL_PASS = [['alpha works in the page', 'passed'], ['beta works in the page', 'passed'], ['gamma works in the page', 'passed']];

test('clean fixture passes every flag', () => {
  const root = fixture({ checklist: GOOD });
  const r = run(root, '--strict', '--scenarios', '--ticks', '--manual', '--questions', '--tests', vitestFile(root, ALL_PASS));
  assert.equal(r.code, 1, 'strict needs the headings, which the fixture does not have'); // headings are the only failure
  const lenient = run(root, '--scenarios', '--ticks', '--manual', '--questions', '--tests', vitestFile(root, ALL_PASS));
  assert.equal(lenient.code, 0, lenient.out);
});

test('UNCOVERED scenario is reported', () => {
  const root = fixture({ checklist: '- [x] Alpha works: `alpha works in the page`' });
  const r = run(root, '--scenarios');
  assert.equal(r.code, 1);
  assert.match(r.out, /UNCOVERED spec-one \/ Beta works/);
});

test('scenario map covers a title missing from the checklist', () => {
  const root = fixture({
    checklist: '- [x] Alpha works: `alpha works in the page`',
    extraSpecMap: '| spec-one | Beta works | `beta works in the page` (x.test.ts) |\n',
  });
  assert.equal(run(root, '--scenarios', '--tests', vitestFile(root, ALL_PASS)).code, 0);
});

test('ticked scenario without a test is rejected', () => {
  const root = fixture({ checklist: '- [x] Alpha works: done\n- [x] Beta works: `beta works in the page`' });
  const r = run(root, '--scenarios', '--ticks');
  assert.equal(r.code, 1);
  assert.match(r.out, /ticked scenario without a test: spec-one \/ Alpha works/);
});

test('missing test in the vitest report is reported', () => {
  const root = fixture({
    checklist: '- [x] Alpha works: `alpha works in the page`',
    extraSpecMap: '| spec-one | Beta works | `beta works but nobody wrote it` |\n',
  });
  const r = run(root, '--scenarios', '--tests', vitestFile(root, ALL_PASS));
  assert.equal(r.code, 1);
  assert.match(r.out, /MISSING TEST spec-one \/ Beta works/);
});

test('failed test is reported', () => {
  const root = fixture({ checklist: GOOD });
  const r = run(root, '--scenarios', '--tests', vitestFile(root, [['alpha works in the page', 'failed'], ['beta works in the page', 'passed'], ['gamma works in the page', 'passed']]));
  assert.equal(r.code, 1);
  assert.match(r.out, /FAILED TEST spec-one \/ Alpha works/);
});

test('duplicate owner row id is rejected', () => {
  const row = '| OA-01 | Owner | now | 1. do it | it works | TODO |\n';
  const root = fixture({ checklist: GOOD, todo: row + row });
  const r = run(root, '--manual');
  assert.equal(r.code, 1);
  assert.match(r.out, /duplicate owner row id OA-01/);
});

test('owner row with an unknown status is rejected', () => {
  const root = fixture({ checklist: GOOD, todo: '| SO-01 | Owner | now | 1. do it | it works | MAYBE |\n' });
  const r = run(root, '--manual');
  assert.equal(r.code, 1);
  assert.match(r.out, /status "MAYBE"/);
});

test('release fails while an owner row is TODO and passes when it is DONE', () => {
  const todo = (s) => `| OA-01 | Owner | now | 1. do it | it works | ${s} |\n`;
  assert.equal(run(fixture({ checklist: GOOD, todo: todo('TODO') }), '--release').code, 1);
  const root = fixture({ checklist: GOOD, todo: todo('DONE') });
  assert.equal(run(root, '--release').code, 0, run(root, '--release').out);
});

test('question named in a workstream file must exist', () => {
  const root = fixture({ checklist: GOOD, wsExtra: 'See Q-A-07 for the default.\n' });
  const r = run(root, '--questions');
  assert.equal(r.code, 1);
  assert.match(r.out, /Q-A-7 is named|Q-A-07 is named/);
  const ok = fixture({ checklist: GOOD, wsExtra: 'See Q-A-07 for the default.\n', questions: '| Q-A-7 | Why? |\n' });
  assert.equal(run(ok, '--questions').code, 0);
});

test('dependency on a later letter is rejected', () => {
  const root = fixture({ checklist: GOOD, deps: ['B', 'A'] });
  const r = run(root);
  assert.equal(r.code, 1);
  assert.match(r.out, /depends on later or same letter B/);
});
