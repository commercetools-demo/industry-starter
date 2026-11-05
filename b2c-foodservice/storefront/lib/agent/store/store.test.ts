// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Product } from '../shopping/types';
import { BlobsSessionStore, type BlobStoreLike } from './blobs-store';
import { MemorySessionStore } from './memory-store';
import { type SessionStore, type StoredSession, VersionConflict, decodeSession } from './session-store';

const product = (id: string, over: Partial<Product> = {}): Product => ({ productId: id, title: `Title ${id}`, price: 12.5, currency: 'USD', labels: [], attributes: {}, inStock: true, options: {}, optionValues: {}, ...over });

const minimal = (id = 'a'.repeat(24)): StoredSession => ({ id, principal: { userId: 'anon-1' }, provenance: [], messages: [], createdAt: '2026-11-04T10:00:00.000Z' });

/** A Netlify Blobs double with real etag semantics: conditional writes return modified:false instead of overwriting. */
function fakeBlobs(): BlobStoreLike {
  const data = new Map<string, { value: string; etag: string }>();
  let n = 0;
  return {
    async getWithMetadata(key) {
      const rec = data.get(key);
      return rec ? { data: rec.value, etag: rec.etag } : null;
    },
    async set(key, value, options = {}) {
      const rec = data.get(key);
      if (options.onlyIfNew && rec) return { modified: false };
      if (options.onlyIfMatch !== undefined && (!rec || rec.etag !== options.onlyIfMatch)) return { modified: false };
      n += 1;
      const etag = `etag-${n}`;
      data.set(key, { value, etag });
      return { modified: true, etag };
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

const stores: [string, () => SessionStore][] = [
  ['memory', () => new MemorySessionStore({})],
  ['blobs', () => new BlobsSessionStore(fakeBlobs())],
];

describe.each(stores)('%s session store', (_name, make) => {
  it('Creates, loads and refuses a second create of the same id', async () => {
    const store = make();
    const v = await store.create(minimal());
    expect((await store.get(minimal().id))?.version).toBe(v);
    await expect(store.create(minimal())).rejects.toBeInstanceOf(VersionConflict);
    expect(await store.get('b'.repeat(24))).toBeNull();
  });

  it('A lost race writes nothing: two saves from the same version, the second is refused', async () => {
    const store = make();
    const v1 = await store.create(minimal());
    const first = { ...minimal(), messages: [{ role: 'user' as const, content: 'A' }] };
    const second = { ...minimal(), messages: [{ role: 'user' as const, content: 'B' }] };
    const v2 = await store.save(first, v1);
    await expect(store.save(second, v1)).rejects.toBeInstanceOf(VersionConflict);
    const held = await store.get(minimal().id);
    expect(held?.session.messages).toEqual([{ role: 'user', content: 'A' }]);
    expect(held?.version).toBe(v2);
  });

  it('Saves chain on the version the store returned, never a predicted one', async () => {
    const store = make();
    let v = await store.create(minimal());
    for (let i = 0; i < 3; i += 1) v = await store.save({ ...minimal(), messages: [{ role: 'user', content: `m${i}` }] }, v);
    expect((await store.get(minimal().id))?.session.messages).toHaveLength(1);
    expect((await store.get(minimal().id))?.version).toBe(v);
  });

  it('Record with every optional field absent round trips, and nothing is stored as null', async () => {
    const store = make();
    await store.create(minimal());
    const loaded = (await store.get(minimal().id))!.session;
    expect(loaded).toEqual(minimal());
    expect(JSON.stringify(loaded)).not.toContain('null');
    expect(loaded.principal).not.toHaveProperty('customerId');
  });

  it('A record written by the earlier build, with agentCartId, still decodes', () => {
    const legacy = { ...minimal(), agentCartId: 'cart-old' };
    const decoded = decodeSession(JSON.stringify(legacy));
    expect(decoded.id).toBe(minimal().id);
    expect(decoded.messages).toEqual([]);
  });

  it('A record with every optional field present round trips', async () => {
    const store = make();
    const full: StoredSession = {
      ...minimal(),
      principal: { userId: 'c1', customerId: 'c1', anonymousId: 'an', country: 'US', locale: 'en-US', currency: 'USD', timezone: 'America/New_York' },
      provenance: [['MCF-A', product('MCF-A', { brand: 'Malva', rating: 4.5, reviewCount: 3, imageUrl: 'https://x/y.jpg', category: 'Pods', shortDescription: 's', variantOf: 'fam:1' })]],
      messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: [{ type: 'text', text: 'yo' }] }],
    };
    await store.create(full);
    expect((await store.get(full.id))!.session).toEqual(full);
  });

  it('Provenance with numeric ids keeps insertion order', async () => {
    const store = make();
    const ids = ['100002', '9', 'MCF-B', '100001', '1'];
    await store.create({ ...minimal(), provenance: ids.map((id) => [id, product(id)] as [string, Product]) });
    expect((await store.get(minimal().id))!.session.provenance.map(([id]) => id)).toEqual(ids);
  });

  it('Delete removes the record', async () => {
    const store = make();
    await store.create(minimal());
    await store.delete(minimal().id);
    expect(await store.get(minimal().id)).toBeNull();
  });

  it('Stored size at the provenance cap is measured and small enough', async () => {
    const store = make();
    const cap = 60;
    const records = Array.from({ length: cap }, (_, i) => [`MCF-POD-${i}`, product(`MCF-POD-${i}`, { brand: 'Malva', rating: 4.2, reviewCount: 120, imageUrl: `https://images.example.com/products/${i}/large.jpg`, shortDescription: 'x'.repeat(160), attributes: { roast: 'dark', origin: 'Colombia', pack: '50 capsules' } })] as [string, Product]);
    const session = { ...minimal(), provenance: records };
    await store.create(session);
    const bytes = Buffer.byteLength(JSON.stringify((await store.get(session.id))!.session));
    console.info(`[store.test] provenance at cap (${cap}): ${bytes} bytes`);
    expect(bytes).toBeLessThan(200_000);
  });
});

describe('store guards', () => {
  it('The memory store refuses to construct in production', () => {
    expect(() => new MemorySessionStore({ NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('The blobs store rejects an odd session id instead of using it as a key', async () => {
    const store = new BlobsSessionStore(fakeBlobs());
    await expect(store.get('../../x')).rejects.toThrow(/invalid session id/);
    await expect(store.create({ ...minimal(), id: 'short' })).rejects.toThrow(/invalid session id/);
  });
});
