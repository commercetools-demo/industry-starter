import { describe, expect, it } from 'vitest';
import { applyPlan, newCtx, planAll } from './reconcile';
import { renderReport } from './report';
import { FakeCt } from './test/fake-ct';
import { asReconciler, type AnyReconciler, type Draft, type Kind, type SeedManifest } from './types';

interface Simple extends Draft {
  name: string;
  needs?: { kind: Kind; key: string };
  incompatible?: boolean;
}
type Existing = { key: string; name: string; version: number };

/** A trivial reconciler over `recurrence-policies` (name only), used to test the engine itself. */
function simple(kind: Kind, order: number): AnyReconciler {
  const coll = 'recurrence-policies';
  return asReconciler<Simple, Existing>({
    kind,
    order,
    refs: (d) => (d.needs ? [{ ...d.needs, from: { kind, key: d.key } }] : []),
    fetch: async (api, key) => (await api.get(`${coll}/key=${key}`)) as Existing | null,
    create: async (api, d) => void (await api.post(coll, { key: d.key, name: d.name })),
    diff: (existing, d) => {
      if (d.incompatible && existing.name !== d.name) return { changes: [], conflict: 'attribute type changed' };
      return existing.name === d.name ? { changes: [] } : { changes: [{ path: 'name', from: existing.name, to: d.name }] };
    },
    update: async (api, existing, changes, d) => void (await api.post(`${coll}/key=${d.key}`, { version: existing.version, actions: [{ action: 'setName', name: d.name }] })),
    remove: async (api, existing) => void (await api.del(`${coll}/key=${existing.key}`, { version: existing.version })),
  });
}

const reconcilers = [simple('productType', 50), simple('category', 60), simple('product', 80)];

function manifest(over: Partial<Record<Kind, Simple[]>> = {}): SeedManifest {
  const m: Partial<Record<Kind, Simple[]>> = {
    productType: [{ key: 'malva-type', name: 'Type' }],
    category: [
      { key: 'malva-cat-a', name: 'A' },
      { key: 'malva-cat-b', name: 'B' },
    ],
    product: [{ key: 'malva-p', name: 'P', needs: { kind: 'productType', key: 'malva-type' } }],
    ...over,
  };
  return m;
}

async function run(api: FakeCt, m: SeedManifest) {
  const ctx = newCtx();
  const plan = await planAll(api, m, reconcilers, ctx);
  const results = await applyPlan(api, m, plan, reconcilers, ctx);
  return { plan, results, report: renderReport(results) };
}

describe('seed engine', () => {
  it('Second run changes nothing: every item unchanged and zero writes', async () => {
    const api = new FakeCt();
    const first = await run(api, manifest());
    expect(first.report.counts.created).toBe(4);
    api.writes = 0;
    const second = await run(api, manifest());
    expect(api.writes).toBe(0);
    expect(second.report.counts).toEqual({ created: 0, updated: 0, unchanged: 4, skipped: 0, failed: 0 });
    expect(second.report.exitCode).toBe(0);
  });

  it('Manifest edited: only the affected resource is updated and listed as updated', async () => {
    const api = new FakeCt();
    await run(api, manifest());
    const edited = manifest({ category: [{ key: 'malva-cat-a', name: 'A renamed' }, { key: 'malva-cat-b', name: 'B' }] });
    const second = await run(api, edited);
    const updated = second.results.filter((r) => r.outcome.status === 'updated');
    expect(updated).toHaveLength(1);
    expect(updated[0].key).toBe('malva-cat-a');
    expect(updated[0].outcome).toEqual({ status: 'updated', changes: [{ path: 'name', from: 'A', to: 'A renamed' }] });
    expect(second.report.text).toContain('name: A -> A renamed');
  });

  it('Interrupted run resumes: existing keys recognised, remaining created, no duplicates', async () => {
    const api = new FakeCt();
    api.failOnCreate = 3;
    const first = await run(api, manifest());
    expect(first.report.counts.created).toBe(3);
    expect(first.report.counts.failed).toBe(1);
    expect(first.report.exitCode).toBe(1);
    const second = await run(api, manifest());
    expect(second.report.counts.created).toBe(1);
    expect(second.report.counts.unchanged).toBe(3);
    expect(api.list('recurrence-policies')).toHaveLength(4);
  });

  it('Dependencies respected: resources are created in dependency order', async () => {
    const api = new FakeCt();
    const base = manifest();
    const reversed: SeedManifest = { product: base.product, category: base.category, productType: base.productType };
    await run(api, reversed);
    expect(api.log.filter((l) => l.startsWith('create'))).toEqual([
      'create recurrence-policies malva-type',
      'create recurrence-policies malva-cat-a',
      'create recurrence-policies malva-cat-b',
      'create recurrence-policies malva-p',
    ]);
  });

  it('Incompatible product type change: reports the conflict and skips the type and its products', async () => {
    const api = new FakeCt();
    await run(api, manifest());
    const changed = manifest({ productType: [{ key: 'malva-type', name: 'Type v2', incompatible: true }] });
    const second = await run(api, changed);
    const byKey = Object.fromEntries(second.results.map((r) => [r.key, r.outcome]));
    expect(byKey['malva-type']).toEqual({ status: 'skipped', reason: 'attribute type changed' });
    expect(byKey['malva-p']).toEqual({ status: 'skipped', reason: 'depends on productType "malva-type" (attribute type changed)' });
    expect(second.report.exitCode).toBe(4);
    expect(api.byKey('recurrence-policies', 'malva-type')?.name).toBe('Type');
  });

  it('retries a 409 by re-reading the resource', async () => {
    const api = new FakeCt();
    await run(api, manifest());
    const base = simple('category', 60);
    let stale = true;
    const racing: AnyReconciler = {
      ...base,
      fetch: async (a, key) => {
        const res = (await base.fetch(a, key)) as Existing | null;
        if (res && stale) {
          stale = false;
          return { ...res, version: res.version - 1 };
        }
        return res;
      },
    };
    const m = manifest({ category: [{ key: 'malva-cat-a', name: 'A2' }] });
    const ctx = newCtx();
    const plan = await planAll(api, m, [racing], ctx);
    const results = await applyPlan(api, m, plan, [racing], ctx);
    expect(results.find((r) => r.key === 'malva-cat-a')?.outcome.status).toBe('updated');
    expect(api.byKey('recurrence-policies', 'malva-cat-a')?.name).toBe('A2');
  });
});
