// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Run: node --test plans/
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, nameMatches, norm, parseSpec, testNames, withBlock } from './spec-coverage.mjs';

const SPEC = `# x
### Requirement: First
#### Scenario: Alpha one
#### Scenario: Beta two
### Requirement: Second
#### Scenario: Empty
`;

test('spec-coverage parses headings', () => {
  const reqs = parseSpec(SPEC);
  assert.equal(reqs.length, 2);
  assert.deepEqual(reqs.flatMap((r) => r.scenarios), ['Alpha one', 'Beta two', 'Empty']);
});

test('spec-coverage classifies covered and uncovered scenarios', () => {
  const testIndex = new Map([['storefront/a.test.ts', testNames("describe('Alpha one: thing', () => { it('does it', () => {}); });")]]);
  const testFileSet = new Map([['b.test.ts', ['storefront/b.test.ts']]]);
  const planLines = [{ text: '| Beta two | `b.test.ts` "x" |', n: norm('| Beta two | `b.test.ts` "x" |') }, { text: 'Gamma three is planned', n: norm('Gamma three is planned') }];
  const evidenceTexts = [{ file: 'plans/evidence/X/recipe-log.md', n: norm('checked Delta four live') }];
  const ctx = { testIndex, planLines, evidenceTexts, testFileSet };
  assert.equal(classify({ title: 'Alpha one', ...ctx }).level, 'TEST');
  assert.deepEqual(classify({ title: 'Beta two', ...ctx }).refs, ['storefront/b.test.ts']);
  assert.equal(classify({ title: 'Beta two', ...ctx }).level, 'MAPPED');
  assert.equal(classify({ title: 'Delta four', ...ctx }).level, 'EVIDENCE');
  assert.equal(classify({ title: 'Gamma three', ...ctx }).level, 'PLANNED');
  assert.equal(classify({ title: 'Epsilon five', ...ctx }).level, 'UNCOVERED');
});

test('spec-coverage short titles need an exact test name', () => {
  assert.equal(nameMatches(norm('EmptyCart hides summary'), norm('Empty')), false);
  assert.equal(nameMatches(norm('Empty'), norm('Empty')), true);
  assert.equal(nameMatches(norm('Quantity change updates totals: hooks/useCart'), norm('Quantity change updates totals')), true);
});

test('spec-coverage keeps the rest of SPEC-COVERAGE.md when it rewrites its block', () => {
  const first = withBlock('# head\n', 'one');
  assert.match(first, /one/);
  const second = withBlock(first, 'two');
  assert.match(second, /# head/);
  assert.ok(!second.includes('one'));
  assert.match(second, /two/);
});
