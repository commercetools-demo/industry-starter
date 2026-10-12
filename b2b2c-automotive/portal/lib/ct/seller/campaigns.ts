// Co-op campaigns (W-01, W-03). Campaigns are Malva-owned custom objects (container `malva-coop-campaigns`) and read only here.
// "Create discount" writes a draft (inactive) cart discount for the signed-in store only; the code is `<CODE>-<STOREKEY>` because
// discount codes are unique across the project (D2). There is no function that edits a caption. A funding claim is a store-owned
// object `malva-coop-claims` / `<campaignKey>--<storeKey>` that Malva approves in the Merchant Center.
import 'server-only';
import type { CartDiscountDraft } from '@commercetools/platform-sdk';
import { CatalogError } from '@/lib/catalog/errors';
import type { Campaign, CampaignView, ClaimInput, ClaimStatus } from '@/lib/w-types';
import { allocateSortOrder } from '@/lib/catalog/sort-order';
import { hydrateBySkus } from './catalog-data';
import { getSellerStore } from './store-info';
import { retryOnConflict } from './versioned';
import { CONTAINERS, listObjects, readObject, upsertObject } from './w-objects';
import { wRoot } from './w-root';

export type { Campaign, CampaignView, ClaimInput, ClaimStatus };

interface StoredClaim extends ClaimInput {
  campaignKey: string;
  storeKey: string;
  status: Exclude<ClaimStatus, 'none'>;
  submittedAt: string;
}

const CODE = /^[A-Z0-9_-]{2,40}$/;
const isCampaign = (v: unknown): v is Campaign => {
  const c = v as Campaign | null;
  return !!c && typeof c.key === 'string' && typeof c.code === 'string' && CODE.test(c.code) && Number.isInteger(c.permyriad) && c.permyriad >= 1 && c.permyriad <= 10000 && Array.isArray(c.eligibleSkus);
};

export const discountKeyOf = (campaignKey: string, storeKey: string): string => `coop-${campaignKey}-${storeKey}`;
export const storeCode = (code: string, storeKey: string): string => `${code}-${storeKey.toUpperCase()}`;
const claimKey = (campaignKey: string, storeKey: string) => `${campaignKey}--${storeKey}`;

async function readCampaign(campaignKey: string): Promise<Campaign> {
  const object = await readObject<Campaign>(CONTAINERS.campaigns, campaignKey);
  if (!object || !isCampaign(object.value)) throw new CatalogError(404, 'CAMPAIGN_NOT_FOUND', 'Not found');
  return { ...object.value, key: object.key };
}

const isEnded = (c: Pick<Campaign, 'endsAt'>, now: number) => Date.parse(c.endsAt) < now;

export async function listCampaigns(storeKey: string, now: number = Date.now()): Promise<CampaignView[]> {
  const [objects, root] = await Promise.all([listObjects<Campaign>(CONTAINERS.campaigns), wRoot()]);
  const campaigns = objects.filter((o) => isCampaign(o.value)).map((o) => ({ ...o.value, key: o.key }));
  const views: CampaignView[] = [];
  for (const c of campaigns) {
    const first = c.eligibleSkus.slice(0, 5);
    const infos = await hydrateBySkus(first);
    const claim = (await readObject<StoredClaim>(CONTAINERS.claims, claimKey(c.key, storeKey)))?.value;
    let discount: CampaignView['discount'] = null;
    try {
      const d = (await root.cartDiscounts().withKey({ key: discountKeyOf(c.key, storeKey) }).get().execute()).body;
      discount = { id: d.id, key: d.key ?? '', isActive: d.isActive, code: storeCode(c.code, storeKey) };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) throw error;
    }
    views.push({
      ...c,
      ended: isEnded(c, now),
      eligible: first.map((sku) => ({ sku, name: infos.get(sku)?.name ?? { 'en-US': sku } })),
      eligibleMore: Math.max(0, c.eligibleSkus.length - first.length),
      claim: claim && claim.storeKey === storeKey ? { status: claim.status, amountCents: claim.amountCents, invoiceReference: claim.invoiceReference } : { status: 'none' },
      discount,
    });
  }
  return views.sort((a, b) => (a.ended === b.ended ? a.key.localeCompare(b.key) : a.ended ? 1 : -1));
}

async function heldCartSortOrders(): Promise<Set<string>> {
  const root = await wRoot();
  const held = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { body } = await root.cartDiscounts().get({ queryArgs: { limit: 500, offset } }).execute();
    for (const d of body.results) held.add(d.sortOrder);
    if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
  }
  return held;
}

/**
 * Creates the store's draft cart discount and code for a campaign: inactive until the reseller activates it in the Catalog area.
 * 409 `CAMPAIGN_ENDED` for an ended campaign, 409 `DISCOUNT_EXISTS` when the store has one already.
 */
export async function createCoopDiscount(storeKey: string, campaignKey: string, now: number = Date.now()): Promise<{ id: string; key: string; code: string; isActive: false }> {
  const campaign = await readCampaign(campaignKey);
  if (isEnded(campaign, now)) throw new CatalogError(409, 'CAMPAIGN_ENDED', 'This campaign has ended');
  await getSellerStore(storeKey); // 404 for an unknown store
  const root = await wRoot();
  const key = discountKeyOf(campaign.key, storeKey);
  try {
    await root.cartDiscounts().withKey({ key }).get().execute();
    throw new CatalogError(409, 'DISCOUNT_EXISTS', 'This store already has a discount for the campaign');
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    if ((error as { statusCode?: number }).statusCode !== 404) throw error;
  }
  const skus = campaign.eligibleSkus.filter((s) => /^[A-Za-z0-9._-]{1,64}$/.test(s));
  const draft: CartDiscountDraft = {
    key,
    name: campaign.name,
    value: { type: 'relative', permyriad: campaign.permyriad },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: skus.length ? `sku in (${skus.map((s) => `"${s}"`).join(', ')})` : 'true' },
    sortOrder: allocateSortOrder('cart', await heldCartSortOrders(), 'malva-funded'),
    requiresDiscountCode: true,
    stackingMode: 'Stacking',
    stores: [{ typeId: 'store', key: storeKey }],
    isActive: false,
    validFrom: campaign.startsAt,
    validUntil: campaign.endsAt,
    custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'malva', storeKey } },
  };
  const created = (await root.cartDiscounts().post({ body: draft }).execute()).body;
  const code = storeCode(campaign.code, storeKey);
  try {
    // The code is active at once; it does nothing while the discount is inactive.
    await root.discountCodes().post({ body: { code, name: campaign.name, cartDiscounts: [{ typeId: 'cart-discount', id: created.id }], isActive: true } }).execute();
  } catch (error) {
    // Keep the operation all or nothing: remove the discount that has no code.
    await retryOnConflict(async () => {
      const current = (await root.cartDiscounts().withId({ ID: created.id }).get().execute()).body;
      await root.cartDiscounts().withId({ ID: created.id }).delete({ queryArgs: { version: current.version } }).execute();
    });
    if ((error as { statusCode?: number }).statusCode === 400) throw new CatalogError(409, 'CODE_TAKEN', 'This code is already in use');
    throw error;
  }
  return { id: created.id, key, code, isActive: false };
}

/** Proof of spend: amount, invoice reference and note (no file: there is no binary storage, Q-W09). Sets `submitted`. */
export async function submitClaim(storeKey: string, campaignKey: string, input: ClaimInput, now: number = Date.now()): Promise<{ status: 'submitted' }> {
  const campaign = await readCampaign(campaignKey);
  const key = claimKey(campaign.key, storeKey);
  await upsertObject<StoredClaim>(CONTAINERS.claims, key, (current) => {
    if (current && current.storeKey === storeKey && current.status === 'submitted') throw new CatalogError(409, 'CLAIM_PENDING', 'A claim for this campaign is waiting for Malva');
    if (current && current.storeKey === storeKey && current.status === 'approved') throw new CatalogError(409, 'CLAIM_CLOSED', 'This claim was approved');
    return { ...input, campaignKey: campaign.key, storeKey, status: 'submitted', submittedAt: new Date(now).toISOString() };
  });
  return { status: 'submitted' };
}
