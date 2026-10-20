// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Kind } from './api';
import { DELETE_ORDER, MAX_MANIFEST_AGE_MS, assertCleanupAllowed, loadManifest, planCleanup, runCleanup } from './cleanup';
import { buildManifest, formatManifestCounts, type Manifest } from './inventory';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';

const quiet = () => undefined;
const KEY = 'malva-test-project';
const lang = (en: string) => ({ 'en-US': en });

/** A project with MC-style sample data that references each other the way the real sample data does. */
function sampleProject(): FakeApi {
  const api = new FakeApi();
  const zone = api.put('zones', { key: 'sample-zone', name: 'Sample zone' });
  const tax = api.put('tax-categories', { key: 'sample-tax', name: 'Sample tax', rates: [] });
  api.put('shipping-methods', { key: 'sample-ship', name: 'Sample shipping', zoneRates: [{ zone: { typeId: 'zone', id: zone.id }, shippingRates: [] }], taxCategory: { typeId: 'tax-category', id: tax.id } });
  const pt = api.put('product-types', { key: 'sample-type', name: 'Sample type' });
  const root = api.put('categories', { key: 'sample-cat', name: lang('Root'), ancestors: [] });
  const child = api.put('categories', { key: 'sample-cat-child', name: lang('Child'), ancestors: [{ typeId: 'category', id: root.id }] });
  api.put('categories', { key: 'sample-cat-grandchild', name: lang('Grandchild'), ancestors: [{ typeId: 'category', id: root.id }, { typeId: 'category', id: child.id }] });
  const channel = api.put('channels', { key: 'sample-channel', name: lang('Sample channel') });
  api.put('inventory', { sku: 'SAMPLE-1', supplyChannel: { typeId: 'channel', id: channel.id }, quantityOnStock: 3 });
  api.put('products', { key: 'sample-product', productType: { typeId: 'product-type', id: pt.id }, masterData: { published: true, current: { name: lang('Sample product') }, staged: { name: lang('Sample product') } } });
  api.put('products', { masterData: { published: false, current: {}, staged: { name: lang('Keyless product') } } });
  api.put('types', { key: 'sample-type-custom', name: lang('Custom') });
  api.put('customers', { key: 'sample-customer', email: 'sample@example.com' });
  api.put('states', { key: 'builtin-state', builtIn: true, type: 'LineItemState' });
  const s2 = api.put('states', { key: 'sample-state-b', builtIn: false, type: 'OrderState' });
  api.put('states', { key: 'sample-state-a', builtIn: false, type: 'OrderState', transitions: [{ typeId: 'state', id: s2.id }] });
  return api;
}

const freshManifest = async (api: FakeApi, now = new Date()): Promise<Manifest> => buildManifest(api, KEY, now);

describe('Safe cleanup of sample data', () => {
  it('Review before delete', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    // resource type, key or id and name for each entry, and a count per type
    expect(m.entries.length).toBeGreaterThan(10);
    for (const e of m.entries) {
      expect(e.type).toBeTruthy();
      expect(e.ref).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.version).toBeGreaterThanOrEqual(1);
    }
    expect(m.entries.find((e) => e.type === 'products' && e.key === 'sample-product')?.name).toBe('Sample product');
    expect(m.entries.find((e) => e.type === 'products' && !e.key)?.ref).toBe(m.entries.find((e) => e.type === 'products' && !e.key)?.id); // keyless: id
    expect(m.counts.products).toBe(2);
    expect(m.counts.categories).toBe(3);
    expect(m.counts.states).toBe(2); // the built-in state is not listed
    expect(m.createdAt).toMatch(/^\d{4}-/);
    expect(formatManifestCounts(m).join('\n')).toContain('categories');
    // the manifest file round-trips
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'manifest-')), 'cleanup-manifest.json');
    writeFileSync(file, JSON.stringify(m));
    expect(loadManifest(file).entries.length).toBe(m.entries.length);
    expect(() => loadManifest(path.join(path.dirname(file), 'missing.json'))).toThrow();
    writeFileSync(file, '{"nope": true}');
    expect(() => loadManifest(file)).toThrow(/not a cleanup manifest/);
  });

  it('inventory lists seed-owned resources only as a count and never reads orders or carts', async () => {
    const api = sampleProject();
    await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
    const m = await freshManifest(api);
    expect(m.entries.some((e) => (e.key ?? '').startsWith('mcf-'))).toBe(false);
    expect(m.skippedSeedOwned.products).toBe(41);
    expect(m.entries.some((e) => (e.type as string) === 'orders' || (e.type as string) === 'carts')).toBe(false);
  });

  it('Wrong confirmation', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    const before = api.requests;
    const run = new Runner(false, quiet);
    await expect(runCleanup({ api, run, manifest: m, projectKey: KEY, confirm: 'some-other-project' })).rejects.toThrow(/--confirm must equal/);
    await expect(runCleanup({ api, run, manifest: m, projectKey: KEY, confirm: undefined })).rejects.toThrow(/--confirm must equal/);
    expect(api.requests).toBe(before); // aborted before any request
    expect(api.all('products')).toHaveLength(2);
  });

  it('Seed data protected', async () => {
    const api = sampleProject();
    const keep = api.put('products', { key: 'mcf-p-keep-me', masterData: { published: false, current: {}, staged: { name: lang('Seed product') } } });
    const m = await freshManifest(api);
    m.entries.push({ type: 'products', ref: 'mcf-p-keep-me', id: keep.id, key: 'mcf-p-keep-me', name: 'Seed product', version: 1, depth: 0 }); // hand-edited into the manifest
    const run = new Runner(false, quiet);
    const r = await runCleanup({ api, run, manifest: m, projectKey: KEY, confirm: KEY });
    expect(r.refused).toEqual([expect.stringContaining('mcf-p-keep-me')]);
    expect(api.all('products').map((p) => p.key)).toEqual(['mcf-p-keep-me']); // refused entry stays, everything else is gone
  });

  it('refuses a manifest older than 24 hours before any request', async () => {
    const api = sampleProject();
    const old = await freshManifest(api, new Date(Date.now() - MAX_MANIFEST_AGE_MS - 60_000));
    const before = api.requests;
    await expect(runCleanup({ api, run: new Runner(false, quiet), manifest: old, projectKey: KEY, confirm: KEY })).rejects.toThrow(/older than 24 hours/);
    expect(api.requests).toBe(before);
    // 23 hours is fine
    const ok = await freshManifest(api, new Date(Date.now() - 23 * 3600_000));
    expect(() => assertCleanupAllowed({ manifest: ok, projectKey: KEY, confirm: KEY, dryRun: false })).not.toThrow();
  });

  it('refuses a manifest written for another project', async () => {
    const api = sampleProject();
    const m = { ...(await freshManifest(api)), projectKey: 'another-project' };
    await expect(runCleanup({ api, run: new Runner(false, quiet), manifest: m, projectKey: KEY, confirm: KEY })).rejects.toThrow(/another-project/);
  });

  it('deletes exactly the manifest entries in dependency order (categories deepest first, products unpublished first)', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    const plan = planCleanup(m);
    const order = plan.entries.map((e) => e.type);
    expect(order).toEqual([...order].sort((a, b) => DELETE_ORDER.indexOf(a) - DELETE_ORDER.indexOf(b)));
    const cats = plan.entries.filter((e) => e.type === 'categories').map((e) => e.ref);
    expect(cats).toEqual(['sample-cat-grandchild', 'sample-cat-child', 'sample-cat']);
    const run = new Runner(false, quiet);
    const r = await runCleanup({ api, run, manifest: m, projectKey: KEY, confirm: KEY });
    expect(r.failed).toEqual([]);
    expect(r.deleted).toBe(m.entries.length);
    for (const kind of DELETE_ORDER) expect(api.all(kind as Kind), kind).toHaveLength(kind === 'states' ? 1 : 0); // the built-in state was never listed
  });

  it('removes only what the reviewed manifest lists', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    // the reviewer removes the sample customer and the sample product from the manifest
    m.entries = m.entries.filter((e) => e.ref !== 'sample-customer' && e.ref !== 'sample-product');
    const r = await runCleanup({ api, run: new Runner(false, quiet), manifest: m, projectKey: KEY, confirm: KEY });
    expect(r.failed.length).toBe(1); // product type is still referenced by the kept product: reported, not forced
    expect(api.all('customers').map((c) => c.key)).toEqual(['sample-customer']);
    expect(api.all('products').map((p) => p.key)).toContain('sample-product');
  });

  it('retries a state that is still referenced by another state of the manifest', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    m.entries.sort((a, b) => (a.ref === 'sample-state-b' ? -1 : b.ref === 'sample-state-b' ? 1 : 0));
    const r = await runCleanup({ api, run: new Runner(false, quiet), manifest: m, projectKey: KEY, confirm: KEY });
    expect(r.failed).toEqual([]);
  });

  it('dry run lists the deletions and sends no write', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    const run = new Runner(true, quiet);
    const r = await runCleanup({ api, run, manifest: m, projectKey: KEY });
    expect(run.lines.every((l) => l.startsWith('would delete '))).toBe(true);
    expect(run.changes).toBe(m.entries.length);
    expect(api.writes).toBe(0);
    expect(r.failed).toEqual([]);
  });

  it('skips an entry that is already gone', async () => {
    const api = sampleProject();
    const m = await freshManifest(api);
    const first = api.all('customers')[0];
    await api.remove('customers', { id: first?.id as string, version: first?.version as number });
    const r = await runCleanup({ api, run: new Runner(false, quiet), manifest: m, projectKey: KEY, confirm: KEY });
    expect(r.failed).toEqual([]);
  });

  it('a manifest file written by inventory has the documented shape', async () => {
    const m = await freshManifest(sampleProject());
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'manifest-')), 'm.json');
    writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
    expect(Object.keys(parsed).sort()).toEqual(['counts', 'createdAt', 'entries', 'projectKey', 'skippedSeedOwned']);
    expect(Object.keys(parsed.entries[0] ?? {}).sort()).toEqual(expect.arrayContaining(['id', 'name', 'ref', 'type', 'version']));
  });
});
