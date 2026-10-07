// @vitest-environment node
// A release must be applied at least RELEASE_MIN_LEAD_MS ahead: a NEW offer only reaches the cached lists after the catalog cache
// expires, so every catalog and search TTL has to be at most half of the lead time.
import * as cache from '@/lib/config/cache';
import { RELEASE_MIN_LEAD_MS } from '@/lib/offers/release';
import { RELEASE_MIN_LEAD_MS as ENGINE_LEAD_MS } from '../../scripts/seed/release/types';

describe('release lead time vs cache TTLs', () => {
  it('every catalog read TTL is at most half of the lead time', () => {
    // constants used by lib/ct/catalog.ts and lib/ct/search.ts: CATALOG_TTL (offers and facts), CATEGORY_TREE_TTL (category tree);
    // PRODUCT_TYPE_IDS_TTL maps type keys to ids and never holds an offer
    for (const ttlSeconds of [cache.CATALOG_TTL, cache.CATEGORY_TREE_TTL]) {
      expect(ttlSeconds * 1000).toBeLessThanOrEqual(RELEASE_MIN_LEAD_MS / 2);
    }
  });

  it('the engine and the read side use the same lead time (10 minutes)', () => {
    expect(ENGINE_LEAD_MS).toBe(RELEASE_MIN_LEAD_MS);
    expect(RELEASE_MIN_LEAD_MS).toBe(10 * 60 * 1000);
  });
});
