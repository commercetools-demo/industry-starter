// Test support: a fake project holding a few Malva offers, and the example manifest. Not used at run time.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newCtx } from '../reconcile';
import { productReconciler } from '../reconcilers/product';
import { FakeCt } from '../test/fake-ct';
import type { ProductDraft } from '../types';
import { parseReleaseManifest } from './parse';
import type { ReleaseManifest } from './types';

export const NOW = new Date('2026-10-07T10:00:00Z');
export const RELEASE_AT = '2026-10-07T10:30:00Z';
export const EXAMPLE_KEY = 'malva-rel-example-summer-unlimited';

const exampleFile = path.resolve(__dirname, '..', 'releases', 'examples', `${EXAMPLE_KEY}.release.json`);

export function exampleManifest(releaseAt: string = RELEASE_AT): ReleaseManifest {
  return { ...parseReleaseManifest(readFileSync(exampleFile, 'utf8')), releaseAt };
}

export function offerDraft(key: string, sku: string, usd: number, eur: number, extra: Record<string, unknown> = {}): ProductDraft {
  const attributes = {
    'offer-kind': 'base-package',
    'offer-family': 'phone',
    anchors: ['malva-phone-unlimited'],
    audience: ['consumer'],
    'existing-customer': 'any',
    'contract-term': 'month-to-month',
    'charge-type': 'monthly',
    ...extra,
  };
  return {
    key,
    productType: 'malva-offer',
    name: { 'en-US': key, 'de-DE': key },
    slug: { 'en-US': key.replace('malva-offer-', ''), 'de-DE': key.replace('malva-offer-', '') },
    categories: ['malva-cat-phone-plans'],
    taxCategory: 'malva-telecom-services',
    masterVariant: {
      sku,
      key: sku.toLowerCase(),
      attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
      prices: [
        { key: `${sku.toLowerCase()}_usd_malva-monthly`, value: { currencyCode: 'USD', centAmount: usd }, country: 'US', recurrencePolicy: 'malva-monthly' },
        { key: `${sku.toLowerCase()}_eur_malva-monthly`, value: { currencyCode: 'EUR', centAmount: eur }, country: 'DE', recurrencePolicy: 'malva-monthly' },
      ],
    },
    variants: [],
    publish: true,
  };
}

/** product types, categories, tax, recurrence policy, one descriptive product, three offers and one cart discount. */
export async function makeProject(): Promise<FakeCt> {
  const fake = new FakeCt();
  fake.seed('product-types', {
    key: 'malva-offer',
    name: 'Malva offer',
    attributes: [{ name: 'offer-family', savedToLineItem: true }, { name: 'offer-kind', savedToLineItem: true }, { name: 'start-time' }, { name: 'end-time' }],
  });
  fake.seed('product-types', { key: 'malva-phone-plan', name: 'Malva phone plan', attributes: [] });
  fake.seed('categories', { key: 'malva-cat-phone-plans', name: { 'en-US': 'Phone plans' }, ancestors: [] });
  fake.seed('tax-categories', { key: 'malva-telecom-services', name: 'Telecom', rates: [] });
  fake.seed('recurrence-policies', { key: 'malva-monthly', name: { 'en-US': 'Monthly' } });
  fake.seed('cart-discounts', { key: 'malva-cd-second-line-10', sortOrder: '0.1', isActive: true, name: { 'en-US': 'Second line' } });
  const ctx = newCtx();
  await productReconciler.create(
    fake,
    {
      key: 'malva-phone-unlimited',
      productType: 'malva-phone-plan',
      name: { 'en-US': 'Unlimited' },
      slug: { 'en-US': 'unlimited' },
      categories: [],
      taxCategory: 'malva-telecom-services',
      masterVariant: { sku: 'MLV-PLAN-UNLIMITED', attributes: [], prices: [] },
      variants: [],
      publish: true,
    } as ProductDraft,
    ctx,
  );
  await productReconciler.create(fake, offerDraft('malva-offer-spotify', 'MLV-ADD-SPOTIFY-MTH', 999, 999, { 'offer-kind': 'addon', 'offer-family': 'addon' }), ctx);
  await productReconciler.create(fake, offerDraft('malva-offer-phone-online-only', 'MLV-PHN-UNL-ONLINE-M2M', 4500, 4500, { channels: ['online'], 'included-offers': ['malva-offer-spotify'] }), ctx);
  await productReconciler.create(fake, offerDraft('malva-offer-phone-essential', 'MLV-PHN-ESS-M2M', 2500, 2500), ctx);
  fake.writes = 0;
  fake.log.length = 0;
  return fake;
}

/** Everything that can be compared after a failed or cancelled release: products and cart discounts. */
export function stateOf(fake: FakeCt): string {
  const strip = (r: Record<string, unknown>): Record<string, unknown> => {
    const copy = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    const prune = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(prune);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        delete o.id;
        delete o.version;
        Object.values(o).forEach(prune);
      }
    };
    prune(copy);
    return copy;
  };
  return JSON.stringify({ products: fake.list('products').map(strip), discounts: fake.list('cart-discounts').map(strip) });
}
