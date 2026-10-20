// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReviewDraft } from '@commercetools/platform-sdk';
import { K, MARKETS, hash } from './base';
import { CUSTOMERS } from './customers';
import { PRODUCTS, REVIEW_COUNTS, masterSku, type ProductDef } from './products';

/**
 * Seeded reviews (reviews-and-ratings, "Seeded reviews"): 3 to 12 approved reviews per top product, written in the
 * market language of the author, ratings spread 1 to 5 with a realistic skew, keyed `mcf-review-<sku>-<n>`.
 * Reviews 1 to 6 of a product come from the six demo customers (each customer at most once per product); reviews 7 to 12
 * have no customer and a synthetic author name (Q-S-4). Verified-purchase links need orders, which the seed does not create.
 */
export type Locale = 'en-US' | 'en-GB' | 'de-DE';
export interface ReviewDef { key: string; sku: string; productKey: string; n: number; author: string; customerKey?: string; rating: 1 | 2 | 3 | 4 | 5; locale: Locale; title: string; text: string }

type Bucket = 'high' | 'mid' | 'low';
const TEXTS: Record<Locale, Record<Bucket, [title: string, text: string][]>> = {
  'en-US': {
    high: [['Our daily favorite', 'Rich, smooth and consistent. {name} is now part of our morning routine.'], ['Worth every cent', 'Arrived fast and tastes exactly as described. I will order {name} again.'], ['Better than the cafe', 'I did not expect this quality at home. {name} is a clear five stars.'], ['Great value', 'Easy to use and the result is excellent. Happy with {name}.']],
    mid: [['Good, not great', '{name} is fine for the price, but I expected a little more depth.'], ['Decent', 'Does what it should. Packaging could be better.']],
    low: [['Not for me', '{name} was too bitter for my taste, and delivery took longer than promised.'], ['Disappointed', 'Did not meet my expectations. Maybe a different roast would suit me.']],
  },
  'en-GB': {
    high: [['Our daily favourite', 'Rich, smooth and consistent. {name} is now part of our morning routine.'], ['Worth every penny', 'Arrived quickly and tastes just as described. I will order {name} again.'], ['Better than the café', 'I did not expect this quality at home. {name} is a clear five stars.'], ['Brilliant value', 'Easy to use and the result is excellent. Chuffed with {name}.']],
    mid: [['Good, not great', '{name} is fine for the price, but I expected a little more depth.'], ['Decent', 'Does what it should. The packaging could be better.']],
    low: [['Not for me', '{name} was too bitter for my taste, and delivery took longer than promised.'], ['Disappointing', 'Did not meet my expectations. Perhaps a different roast would suit me.']],
  },
  'de-DE': {
    high: [['Unser täglicher Favorit', 'Rund, mild und immer gleich gut. {name} gehört jetzt zu unserem Morgenritual.'], ['Jeden Cent wert', 'Schnell geliefert und genau so, wie beschrieben. {name} bestelle ich wieder.'], ['Besser als im Café', 'Diese Qualität hatte ich zu Hause nicht erwartet. {name} bekommt fünf Sterne.'], ['Sehr gutes Preis-Leistungs-Verhältnis', 'Einfach zu benutzen und ein tolles Ergebnis. Zufrieden mit {name}.']],
    mid: [['Gut, aber nicht überragend', '{name} ist für den Preis in Ordnung, ich hätte etwas mehr Tiefe erwartet.'], ['Solide', 'Erfüllt seinen Zweck. Die Verpackung könnte besser sein.']],
    low: [['Nichts für mich', '{name} war mir zu bitter, und die Lieferung dauerte länger als versprochen.'], ['Enttäuscht', 'Hat meine Erwartungen nicht erfüllt. Vielleicht passt eine andere Röstung besser.']],
  },
};

const GUESTS: { name: string; locale: Locale }[] = [
  { name: 'Sam T.', locale: 'en-US' }, { name: 'Katrin L.', locale: 'de-DE' }, { name: 'Priya N.', locale: 'en-GB' },
  { name: 'Chris D.', locale: 'en-US' }, { name: 'Lukas M.', locale: 'de-DE' }, { name: 'Hannah B.', locale: 'en-GB' },
];

/** Realistic skew: 5% one star, 7% two, 13% three, 30% four, 45% five. */
const ratingOf = (h: number): ReviewDef['rating'] => {
  const r = h % 100;
  return r < 5 ? 1 : r < 12 ? 2 : r < 25 ? 3 : r < 55 ? 4 : 5;
};
const bucketOf = (rating: number): Bucket => (rating >= 4 ? 'high' : rating === 3 ? 'mid' : 'low');

function reviewsOf(p: ProductDef, count: number): ReviewDef[] {
  const sku = masterSku(p);
  const offset = hash(sku) % CUSTOMERS.length;
  const out: ReviewDef[] = [];
  for (let n = 1; n <= count; n += 1) {
    const h = hash(`${sku}#${n}`);
    const rating = ratingOf(h);
    const customer = n <= CUSTOMERS.length ? CUSTOMERS[(offset + n - 1) % CUSTOMERS.length] : undefined;
    const guest = GUESTS[(h >>> 4) % GUESTS.length] as { name: string; locale: Locale };
    const locale: Locale = customer ? MARKETS[customer.country].locale : guest.locale;
    const author = customer ? `${customer.firstName} ${customer.lastName.charAt(0)}.` : guest.name;
    const pool = TEXTS[locale][bucketOf(rating)];
    const [title, text] = pool[(h >>> 8) % pool.length] as [string, string];
    out.push({
      key: reviewKey(sku, n), sku, productKey: p.key, n, author, ...(customer ? { customerKey: customer.key } : {}), rating, locale, title,
      text: text.replace('{name}', p.name['en-US'] as string),
    });
  }
  return out;
}

export const reviewKey = (sku: string, n: number): string => `mcf-review-${sku.toLowerCase()}-${n}`;

export const REVIEWS: ReviewDef[] = PRODUCTS.flatMap((p) => (REVIEW_COUNTS[p.code] ? reviewsOf(p, REVIEW_COUNTS[p.code] as number) : []));

/** Approved reviews per product key, and the statistics the platform should report for them. */
export const reviewCountByProduct = (): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of REVIEWS) out[r.productKey] = (out[r.productKey] ?? 0) + 1;
  return out;
};

export const expectedStats = (productKey: string): { count: number; averageRating: number } => {
  const rs = REVIEWS.filter((r) => r.productKey === productKey);
  return { count: rs.length, averageRating: rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0 };
};

export const reviewDrafts = (): ReviewDraft[] =>
  REVIEWS.map((r) => ({
    key: r.key, uniquenessValue: r.key, authorName: r.author, title: r.title, text: r.text, rating: r.rating, locale: r.locale,
    target: { typeId: 'product' as const, key: r.productKey },
    state: { typeId: 'state' as const, key: K.reviewApproved },
    ...(r.customerKey ? { customer: { typeId: 'customer' as const, key: r.customerKey } } : {}),
  }));
