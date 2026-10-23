// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Scenario ledger used by verify-plan.mjs (workstream Q, D10). No dependencies.
//   scenariosOf(specMd)                      the `#### Scenario:` titles of one spec
//   checklistBlock(workstreamMd, spec)       the lines of the primary workstream's Scenarios checklist that belong to the spec
//   coverageOf(...)                          one row per scenario: covered or not, and the backticked test titles named on its line
//   testsIn(vitestJson)                      Map of test title -> 'passed' | 'failed' from `vitest --reporter=json`
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const norm = (s) => s.toLowerCase().replace(/[`'’"“”]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function scenariosOf(specMd) {
  return [...specMd.matchAll(/^####\s+Scenario:\s*(.+?)\s*$/gm)].map((m) => m[1]);
}

/** Lines of the "Scenarios checklist" section of a workstream file. */
export function checklistSection(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s+(\d+\.\s*)?Scenarios checklist/i.test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** Lines under a header line that names the spec in backticks (`spec`: or ### `spec`), up to the next such header. */
export function checklistBlock(md, spec, allSpecs) {
  const section = checklistSection(md);
  const isHeader = (l) => !/^\s*-\s/.test(l) && allSpecs.some((s) => l.includes('`' + s + '`'));
  const block = [];
  let inside = false;
  for (const line of section) {
    if (isHeader(line)) inside = line.includes('`' + spec + '`');
    else if (inside) block.push(line);
  }
  return block;
}

export function testsIn(json) {
  const map = new Map();
  for (const file of json.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      const status = t.status === 'passed' ? 'passed' : ['pending', 'todo', 'skipped'].includes(t.status) ? 'todo' : 'failed';
      for (const key of [t.title, t.fullName].filter(Boolean)) if (map.get(key) !== 'passed') map.set(key, status);
    }
  }
  return map;
}

/** Backticked phrases of a line that look like test titles (3 words or more). */
export const quoted = (line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((q) => q.split(/\s+/).length >= 3);

/**
 * @param {{ root: string, covered: Map<string, string>, wsFile: (letter: string) => string | undefined }} ctx
 * @returns {{ spec: string, primary: string, title: string, covered: boolean, ticked: boolean, line: string }[]}
 */
export function coverageOf({ root, covered, wsFile }) {
  const rows = [];
  const all = [...covered.keys()];
  for (const [spec, primary] of covered) {
    if (primary === 'n/a') continue;
    const specPath = join(root, 'openspec', 'specs', spec, 'spec.md');
    if (!existsSync(specPath)) continue;
    const titles = scenariosOf(readFileSync(specPath, 'utf8'));
    const file = wsFile(primary);
    const md = file ? readFileSync(file, 'utf8') : '';
    const block = md ? checklistBlock(md, spec, all) : [];
    const section = md ? checklistSection(md) : [];
    for (const title of titles) {
      const t = norm(title);
      const hit = (block.length ? block : section).find((l) => /^\s*-\s*\[[ x]\]/.test(l) && norm(l).includes(t));
      rows.push({ spec, primary, title, covered: Boolean(hit), ticked: Boolean(hit && /\[x\]/i.test(hit)), line: hit ?? '' });
    }
  }
  return rows;
}

export function listWsFile(plansDir) {
  const dir = join(plansDir, 'workstreams');
  return (letter) => {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return undefined;
    const f = readdirSync(dir).find((x) => x.startsWith(letter + '-'));
    return f ? join(dir, f) : undefined;
  };
}
