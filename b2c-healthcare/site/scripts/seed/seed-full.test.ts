import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENTS } from './data/patients';
import { createFakeRoot } from './fake-root';
import { assertProjectKey } from './lib';
import { runSeed } from './seed';
import { checkFullConfirm, runFull } from './seed-full';

const silent = () => {};
const opts = (dryRun: boolean) => ({ dryRun, patientPassword: 'pw', sleep: async () => {} });

describe('seed:full (D-038): reset, cleanup-sample, seed, images, verify, wait-for-search', () => {
  it('on a project holding the sample data, an old seed and customer data it ends with a verified, searchable, re-seedable project', async () => {
    const fake = createFakeRoot({ products: [{ id: 'sample', key: 'charcoal-chair', version: 1, masterData: { published: false, staged: {} } }], taxCategories: [{ id: 'tx', key: 'standard-tax', version: 1 }] });
    await runSeed({ root: fake.root, dryRun: false, log: silent, pauseMs: 0 }, { clinical: true, patientPassword: 'pw' });
    fake.store.orders.push({ id: 'o1', version: 1, customerEmail: PATIENTS[0].email });
    const lines: string[] = [];
    const result = await runFull(fake.root, opts(false), (l) => lines.push(l));
    expect(lines.filter((l) => /FAIL|stopped/.test(l)).join('\n')).toBe('');
    expect(result.stages.map((s) => s.name)).toEqual(['reset (--include-customers)', 'cleanup-sample', 'seed', 'images', 'verify', 'wait-for-search']);
    expect(result.ok).toBe(true);
    expect(fake.store.products.map((p) => String(p.key))).not.toContain('charcoal-chair');
    expect(fake.store.taxCategories.map((t) => String(t.key))).toEqual(['mlv-rx-medicine', 'mlv-consultation']);
    expect(fake.store.orders).toEqual([]);
    expect(fake.store.products).toHaveLength(28);
    expect(lines.join('\n')).toMatch(/PASS {2}every attribute the storefront searches is isSearchable/);
    expect(fake.searchCalls).toBeGreaterThan(0);
  });

  it('--dry-run writes nothing, skips verify and the search wait, and says so', async () => {
    const fake = createFakeRoot();
    await runSeed({ root: fake.root, dryRun: false, log: silent, pauseMs: 0 }, { clinical: true, patientPassword: 'pw' });
    const logged = fake.log.length;
    const objectCalls = fake.objects.calls.filter((c) => c.op === 'delete' || c.op === 'post').length;
    const lines: string[] = [];
    const result = await runFull(fake.root, opts(true), (l) => lines.push(l));
    expect(result.ok).toBe(true);
    expect(result.stages.map((s) => s.name)).toEqual(['reset (--include-customers)', 'cleanup-sample', 'seed', 'images']);
    expect(fake.log.length).toBe(logged);
    expect(fake.objects.calls.filter((c) => c.op === 'delete' || c.op === 'post').length).toBe(objectCalls);
    expect(lines.join('\n')).toContain('verify and wait-for-search are skipped');
  });

  it('a real run needs --confirm <project key>; a dry run does not', () => {
    expect(() => checkFullConfirm({ dryRun: false })).toThrow(/--confirm spec-test-b2c-healthcare/);
    expect(() => checkFullConfirm({ dryRun: false, confirm: 'other' })).toThrow();
    expect(() => checkFullConfirm({ dryRun: true })).not.toThrow();
    expect(() => checkFullConfirm({ dryRun: false, confirm: 'spec-test-b2c-healthcare' })).not.toThrow();
  });

  it('the project-key guard stays in front of everything (no network without the right key)', () => {
    expect(() => assertProjectKey('some-production-project')).toThrow(/Refusing/);
  });

  it('the npm script passes the confirmation and the json-only image script exists', () => {
    const scripts = (JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['seed:full']).toBe('tsx scripts/seed/seed-full.ts --confirm spec-test-b2c-healthcare');
    expect(scripts['seed:images:json']).toBe('tsx scripts/seed/update-images.ts --json-only');
  });
});
