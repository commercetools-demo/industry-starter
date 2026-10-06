// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runChecks } from './verify';
import type { Root } from './lib';

vi.mock('./lib', () => ({ getAdminRoot: vi.fn() }));

/** Every request builder answers with an empty result; only the project itself is specific. */
function fakeRoot(project: Record<string, unknown>): Root {
  const chain: unknown = new Proxy(() => undefined, {
    get: (_t, prop) => (prop === 'execute' ? async () => ({ body: { results: [], zoneRates: [{}, {}] } }) : chain),
    apply: () => chain,
  });
  return new Proxy({} as Root, {
    get: (_t, prop) => (prop === 'get' ? () => ({ execute: async () => ({ body: project }) }) : (chain as never)),
  });
}

const base = { countries: ['US', 'DE'], currencies: ['USD', 'EUR'], languages: ['en-US', 'de-DE'] };

describe('runChecks: search indexing', () => {
  it('Indexing off: the check fails and tells the owner to activate it (OA-04)', async () => {
    const checks = await runChecks(fakeRoot({ ...base, searchIndexing: { productsSearch: { status: 'Deactivated' } } }));
    const indexing = checks.find((c) => c.name.startsWith('product search indexing'));
    expect(indexing?.ok).toBe(false);
    expect(indexing?.detail).toMatch(/owner activates it in Merchant Center \(OA-04\)/);
  });

  it('missing searchIndexing settings fail the same way', async () => {
    const checks = await runChecks(fakeRoot(base));
    expect(checks.find((c) => c.name.startsWith('product search indexing'))?.ok).toBe(false);
  });

  it('Indexing on: the check passes', async () => {
    const checks = await runChecks(fakeRoot({ ...base, searchIndexing: { productsSearch: { status: 'Activated' } } }));
    expect(checks.find((c) => c.name.startsWith('product search indexing'))?.ok).toBe(true);
  });
});
