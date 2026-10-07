import { COLLECTION, asReconciler, type ZoneCoverageDraft } from '../types';
import { removeByKey, type Versioned } from './util';

const COLL = COLLECTION.zoneCoverage;
export const OWN_ZONE_PREFIX = 'malva-zone-';

type ExistingZone = Versioned & { key: string; locations: { country: string }[] };

/**
 * Coverage, not ownership: a country can sit in one zone only, so the reconciler adopts the zone that holds the
 * country (writing its key into ctx.zoneKeys) and creates `malva-zone-<cc>` only when none does.
 */
export const zoneCoverageReconciler = asReconciler<ZoneCoverageDraft, ExistingZone>({
  kind: 'zoneCoverage',
  order: 30,
  refs: () => [],
  fetch: async (api, country) => {
    const res = (await api.get(COLL, { where: `locations(country="${country}")`, limit: 1 })) as { results?: ExistingZone[] } | null;
    return res?.results?.[0] ?? null;
  },
  create: async (api, draft, ctx) => {
    const key = `${OWN_ZONE_PREFIX}${draft.key.toLowerCase()}`;
    await api.post(COLL, { key, name: `Malva ${draft.key}`, locations: [{ country: draft.key }] });
    ctx.zoneKeys[draft.key] = key;
  },
  diff: (existing, draft, ctx) => {
    if (ctx) ctx.zoneKeys[draft.key] = existing.key;
    return { changes: [] };
  },
  update: async () => undefined,
  remove: async (api, existing) => {
    // adopted zones belong to someone else
    if (existing.key.startsWith(OWN_ZONE_PREFIX)) await removeByKey(api, COLL, existing);
  },
});
