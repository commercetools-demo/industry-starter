// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Product catalogue and a small Product Search engine for the local mock commercetools server (workstream G).
// Data: seed-fixtures.json, generated from seed/src/data (see generate.gen.ts). The engine understands the subset of the
// Product Search query language that lib/search/build.ts produces: and / or / not / filter, exact, range, fullText, fuzzy,
// distinct, ranges and count facets, price-level sorting and markMatchingVariants. It is a test double, not a spec.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = JSON.parse(readFileSync(join(here, 'seed-fixtures.json'), 'utf8'));

const humanize = (key) => key.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const channelId = (index) => `chan-${index + 1}`;

// ---------------------------------------------------------------- categories and stores
export const categoryId = (key) => `cat-${key}`;
export const CATEGORY_KEYS = new Map(FIXTURES.categories.map((c) => [c.key, c]));
function ancestorsOf(key) {
  const out = [];
  for (let c = CATEGORY_KEYS.get(key); c; c = c.parent ? CATEGORY_KEYS.get(c.parent) : undefined) out.push(c.key);
  return out;
}

// ---------------------------------------------------------------- attribute definitions
const ATTR_TYPES = new Map();
for (const pt of FIXTURES.productTypes) {
  for (const a of pt.attributes) if (!ATTR_TYPES.has(`${pt.key}:${a.name}`)) ATTR_TYPES.set(`${pt.key}:${a.name}`, a.type);
}

/** Variant attribute value in the API shape (enum -> {key,label}, set of ltext -> [{locale: text}], ...). */
function apiValue(type, raw) {
  if (type.name === 'enum') return { key: raw, label: humanize(raw) };
  if (type.name === 'set') {
    const inner = type.elementType;
    return (Array.isArray(raw) ? raw : [raw]).map((x) => (inner.name === 'enum' ? { key: x, label: humanize(x) } : inner.name === 'ltext' ? x : x));
  }
  return raw;
}

/** { "5": 3, "4": 2 } from a list of star ratings, like reviewRatingStatistics.ratingsDistribution (workstream H). */
const distributionOf = (ratings) => {
  const out = {};
  for (const r of ratings) out[String(r)] = (out[String(r)] ?? 0) + 1;
  return out;
};

// ---------------------------------------------------------------- documents
export const DOCS = FIXTURES.products.map((p, i) => {
  const direct = p.categories.map((k) => categoryId(k));
  const sub = [...new Set(p.categories.flatMap(ancestorsOf).map(categoryId))];
  const variants = p.variants.map((v, vi) => {
    const attrs = { ...p.common, ...v.attrs };
    const list = Object.entries(attrs).map(([name, raw]) => {
      const type = ATTR_TYPES.get(`${p.productType}:${name}`) ?? { name: 'text' };
      return { name, value: apiValue(type, raw), raw, type };
    });
    return { id: vi + 1, sku: v.sku, attrs: list, prices: v.prices, stock: v.stock };
  });
  const ratings = p.ratings;
  return {
    id: uuid(i + 1), index: i, key: p.key, name: p.name, slug: p.slug, description: p.description,
    directCategoryIds: direct, subTreeIds: sub, productType: p.productType, common: p.common,
    createdAt: new Date(Date.UTC(2026, 0, 1) + (FIXTURES.products.length - i) * 86400000).toISOString(),
    stats: ratings.length
      ? { averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length, highestRating: Math.max(...ratings), lowestRating: Math.min(...ratings), ratingsDistribution: distributionOf(ratings) }
      : undefined,
    variants,
  };
});
export const DOC_BY_ID = new Map(DOCS.map((d) => [d.id, d]));
export const VARIANT_BY_SKU = new Map(DOCS.flatMap((d) => d.variants.map((v) => [v.sku, { doc: d, variant: v }])));

const money = (currency, cents) => ({ type: 'centPrecision', currencyCode: currency, centAmount: cents, fractionDigits: 2 });

export function priceFor(variant, country, currency) {
  return variant.prices.find((p) => p.country === country && p.currency === currency);
}

export function stockChannels(variant) {
  const out = {};
  variant.stock.stores.forEach((q, i) => {
    out[channelId(i)] = { isOnStock: q > 0, availableQuantity: q };
  });
  return out;
}

// ---------------------------------------------------------------- recurrence policies and images (workstream H)
const POLICY_SCHEDULES = {
  'mcf-every-2-weeks': { value: 2, intervalUnit: 'Weeks', en: 'Every 2 weeks' },
  'mcf-every-month': { value: 1, intervalUnit: 'Months', en: 'Every month' },
  'mcf-every-2-months': { value: 2, intervalUnit: 'Months', en: 'Every 2 months' },
  'mcf-every-3-months': { value: 3, intervalUnit: 'Months', en: 'Every 3 months' },
};
export const policyId = (key) => `rp-${key}`;
export const RECURRENCE_POLICIES = FIXTURES.recurrencePolicies.map((key) => ({
  id: policyId(key), version: 1, key, name: { 'en-US': POLICY_SCHEDULES[key].en, 'en-CA': POLICY_SCHEDULES[key].en },
  schedule: { type: 'standard', value: POLICY_SCHEDULES[key].value, intervalUnit: POLICY_SCHEDULES[key].intervalUnit },
  createdAt: '2026-01-01T00:00:00.000Z', lastModifiedAt: '2026-01-01T00:00:00.000Z',
}));

/**
 * Placeholder images (clean URLs, no query) so the gallery can be driven in a browser: three per variant, the first one
 * coloured by the variant's colour when it has one. Set MOCK_IMAGES=0 for none (the labelled placeholder).
 */
const COLOUR_BG = { black: '1c1b1f', white: 'cfcfcb', red: 'b3262b', silver: '8a8f96', cream: 'd8c9a8' };
const PRODUCT_BG = ['6359ff', '0a948f', '4f4f99', 'b3262b', '8a6a3a', '3b3a6e'];
function imagesFor(doc, variant) {
  if (process.env.MOCK_IMAGES === '0') return [];
  const colour = variant.attrs.find((a) => a.name === 'colour')?.raw;
  const base = COLOUR_BG[colour] ?? PRODUCT_BG[doc.index % PRODUCT_BG.length];
  return [base, 'f4f0e8', '191741'].map((bg, i) => ({
    url: `https://placehold.co/1200x1440/${bg}/${i === 1 ? '191741' : 'ffffff'}.png`, dimensions: { w: 1200, h: 1440 },
    ...(i === 0 ? { label: `${doc.name['en-US']}, pack shot` } : {}),
  }));
}

/** Product projection (current, published) with price selection and an optional locale projection. */
export function projectionOf(doc, { currency, country, locales }) {
  const pick = (ls) => (locales?.length ? Object.fromEntries(Object.entries(ls).filter(([k]) => locales.includes(k))) : ls);
  const variant = (v) => {
    const price = currency && country ? priceFor(v, country, currency) : undefined;
    // Subscribable products carry one recurring price per policy, 10% below the one-time price (seed: prices.ts).
    const recurrencePrices = price && doc.common.subscribable === true
      ? RECURRENCE_POLICIES.map((p) => ({
          id: `rprice-${v.sku}-${p.key}`, value: money(price.currency, Math.round(price.cents * 0.9)), country,
          recurrencePolicy: { typeId: 'recurrence-policy', id: p.id },
        }))
      : [];
    return {
      id: v.id, sku: v.sku, images: imagesFor(doc, v),
      ...(recurrencePrices.length > 0 ? { recurrencePrices } : {}),
      attributes: v.attrs.map((a) => ({ name: a.name, value: a.value })),
      ...(price ? { price: { id: `price-${v.sku}-${country}`, value: money(price.currency, price.cents), country } } : {}),
      availability: { isOnStock: v.stock.online > 0, availableQuantity: v.stock.online, channels: stockChannels(v) },
    };
  };
  return {
    id: doc.id, version: 1, key: doc.key, name: pick(doc.name), slug: pick(doc.slug), description: pick(doc.description),
    productType: { typeId: 'product-type', id: `pt-${doc.productType}`, obj: { key: doc.productType } },
    categories: doc.directCategoryIds.map((id) => ({ typeId: 'category', id })),
    attributes: Object.entries(doc.common).map(([name, raw]) => ({
      name, value: apiValue(ATTR_TYPES.get(`${doc.productType}:${name}`) ?? { name: 'text' }, raw),
    })),
    masterVariant: variant(doc.variants[0]), variants: doc.variants.slice(1).map(variant),
    ...(doc.stats ? { reviewRatingStatistics: doc.stats } : {}),
    createdAt: doc.createdAt, lastModifiedAt: doc.createdAt,
  };
}

export const productTypeResults = () =>
  FIXTURES.productTypes.map((pt) => ({
    id: `pt-${pt.key}`, version: 1, key: pt.key, name: pt.name,
    attributes: pt.attributes.map((a) => ({
      name: a.name,
      type:
        a.type.name === 'enum'
          ? { name: 'enum', values: a.type.values }
          : a.type.name === 'set' && a.type.elementType.name === 'enum'
            ? { name: 'set', elementType: { name: 'enum', values: a.type.elementType.values } }
            : a.type,
    })),
  }));

// ---------------------------------------------------------------- search engine
const asArray = (x) => (Array.isArray(x) ? x : [x]);

/** Candidate values of a field for a document: a list of `{ value, variant?, price? }`. */
function candidates(doc, field) {
  if (field === 'categories') return doc.directCategoryIds.map((value) => ({ value }));
  if (field === 'categoriesSubTree') return doc.subTreeIds.map((value) => ({ value }));
  if (field === 'name') return [{ value: Object.values(doc.name).join(' ') }];
  if (field === 'createdAt') return [{ value: doc.createdAt }];
  if (field === 'reviewRatingStatistics.averageRating') return doc.stats ? [{ value: doc.stats.averageRating }] : [];
  if (field === 'reviewRatingStatistics.count') return [{ value: doc.stats?.count ?? 0 }];
  if (field === 'variants.sku') return doc.variants.map((variant) => ({ value: variant.sku, variant }));
  if (field === 'variants.availability.isOnStockForChannel') {
    return doc.variants.flatMap((variant) =>
      variant.stock.stores.flatMap((q, i) => (q > 0 ? [{ value: channelId(i), variant }] : [])),
    );
  }
  const price = /^variants\.prices\.(currencyCode|country|centAmount)$/.exec(field);
  if (price) {
    return doc.variants.flatMap((variant) =>
      variant.prices.map((p) => ({
        value: price[1] === 'currencyCode' ? p.currency : price[1] === 'country' ? p.country : p.cents, variant, price: p,
      })),
    );
  }
  const attr = /^variants\.attributes\.([A-Za-z]+)(\.key)?$/.exec(field);
  if (attr) {
    return doc.variants.flatMap((variant) => {
      const a = variant.attrs.find((x) => x.name === attr[1]);
      if (!a) return [];
      return asArray(a.raw).map((value) => ({ value, variant }));
    });
  }
  return [];
}

const sameValue = (a, b, ci) => {
  if (ci) return String(a).toLowerCase() === String(b).toLowerCase();
  return String(a) === String(b);
};

const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const PRICE_FIELD = /^variants\.prices\./;
const leavesOf = (clause) => {
  const [op, body] = Object.entries(clause)[0];
  if (['and', 'or', 'filter', 'not'].includes(op)) return body.flatMap(leavesOf);
  return [{ op, body }];
};

/** Evaluates a clause for a document. `marks` collects matched variant ids (markMatchingVariants) and the score. */
export function matches(clause, doc, marks = { variants: new Set(), score: 0 }) {
  const [op, body] = Object.entries(clause)[0];
  switch (op) {
    case 'and':
    case 'filter': {
      const leaves = body.map((c) => leavesOf(c));
      const allPrice = body.length > 1 && leaves.flat().length > 0 && leaves.flat().every((l) => PRICE_FIELD.test(l.body.field ?? ''));
      if (allPrice) {
        return doc.variants.some((variant) =>
          variant.prices.some((p) =>
            leaves.flat().every((l) => {
              const f = l.body.field;
              const v = f.endsWith('currencyCode') ? p.currency : f.endsWith('country') ? p.country : p.cents;
              return l.op === 'range' ? inRange(v, l.body) : l.op === 'exact' && (l.body.values ?? [l.body.value]).some((x) => sameValue(v, x));
            }),
          ),
        );
      }
      return body.every((c) => matches(c, doc, marks));
    }
    case 'or': {
      let any = false;
      for (const c of body) if (matches(c, doc, marks)) any = true;
      return any;
    }
    case 'not':
      return !body.some((c) => matches(c, doc, { variants: new Set(), score: 0 }));
    case 'exact': {
      const wanted = body.values ?? [body.value];
      const hits = candidates(doc, body.field).filter((c) => wanted.some((w) => sameValue(c.value, w, body.caseInsensitive)));
      if (hits.length === 0) return false;
      if (body.field === 'variants.sku') {
        hits.forEach((h) => marks.variants.add(h.variant.id));
        marks.score += body.boost ?? 1;
      }
      return true;
    }
    case 'range':
      return candidates(doc, body.field).some((c) => inRange(c.value, body));
    case 'fullText': {
      const text = words(candidates(doc, body.field)[0]?.value ?? '');
      const q = words(body.value);
      const ok = q.length > 0 && q.every((t) => text.some((w) => w.startsWith(t)));
      if (ok) marks.score += body.boost ?? 1;
      return ok;
    }
    case 'fuzzy': {
      const text = words(candidates(doc, body.field)[0]?.value ?? '');
      const q = words(body.value);
      const ok = q.length > 0 && q.every((t) => text.some((w) => distance(w, t) <= Math.min(body.level ?? 1, Math.floor(t.length / 3))));
      if (ok) marks.score += 1;
      return ok;
    }
    default:
      throw new Error(`mock search: unsupported expression ${op}`);
  }
}

function inRange(value, b) {
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  return (b.gte === undefined || n >= b.gte) && (b.gt === undefined || n > b.gt) && (b.lte === undefined || n <= b.lte) && (b.lt === undefined || n < b.lt);
}

function marketOf(clause) {
  if (!clause) return {};
  const out = {};
  for (const l of leavesOf(clause)) {
    if (l.op === 'exact' && l.body.field === 'variants.prices.currencyCode') out.currency = l.body.value;
    if (l.op === 'exact' && l.body.field === 'variants.prices.country') out.country = l.body.value;
  }
  return out;
}

function facetOf(facet, docs) {
  const [kind, body] = Object.entries(facet)[0];
  const pool = body.filter ? docs.filter((d) => matches(body.filter, d)) : docs;
  if (kind === 'count') return { name: body.name, value: pool.length };
  if (kind === 'distinct') {
    const counts = new Map();
    for (const d of pool) {
      for (const v of new Set(candidates(d, body.field).map((c) => String(c.value)))) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const buckets = [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return { name: body.name, buckets: buckets.slice(0, body.limit ?? 50) };
  }
  if (kind === 'ranges') {
    const market = marketOf(body.filter);
    const buckets = body.ranges.map((r) => ({
      key: r.key,
      count: pool.filter((d) =>
        candidates(d, body.field).some(
          (c) => (!c.price || ((!market.currency || c.price.currency === market.currency) && (!market.country || c.price.country === market.country))) &&
            inRange(c.value, { gte: r.from, lt: r.to }),
        ),
      ).length,
    }));
    return { name: body.name, buckets };
  }
  throw new Error(`mock search: unsupported facet ${kind}`);
}

function sortKey(doc, spec, score, locale) {
  switch (spec.field) {
    case 'score': return score;
    case 'id': return doc.id;
    case 'createdAt': return doc.createdAt;
    case 'name': return (doc.name[locale] ?? Object.values(doc.name)[0]).toLowerCase();
    case 'reviewRatingStatistics.averageRating': return doc.stats?.averageRating ?? -1;
    case 'reviewRatingStatistics.count': return doc.stats?.count ?? -1;
    case 'variants.prices.centAmount': {
      const m = marketOf(spec.filter);
      const cents = doc.variants.flatMap((v) => v.prices.filter((p) => (!m.currency || p.currency === m.currency) && (!m.country || p.country === m.country)).map((p) => p.cents));
      if (cents.length === 0) return spec.order === 'asc' ? Infinity : -Infinity;
      return spec.mode === 'max' ? Math.max(...cents) : Math.min(...cents);
    }
    default: return 0;
  }
}

/** POST /products/search body to a response (ids only, like the real API). */
export function runSearch(body) {
  const locale = JSON.stringify(body).match(/"language":"([a-z]{2}-[A-Z]{2})"/)?.[1] ?? 'en-US';
  const scored = [];
  for (const doc of DOCS) {
    const marks = { variants: new Set(), score: 0 };
    if (!matches(body.query ?? { filter: [] }, doc, marks)) continue;
    scored.push({ doc, marks });
  }
  const forFacets = scored.map((s) => s.doc);
  const filtered = body.postFilter ? scored.filter((s) => matches(body.postFilter, s.doc)) : scored;
  const sorts = body.sort ?? [{ field: 'createdAt', order: 'desc' }];
  filtered.sort((a, b) => {
    for (const s of sorts) {
      const x = sortKey(a.doc, s, a.marks.score, locale);
      const y = sortKey(b.doc, s, b.marks.score, locale);
      if (x === y) continue;
      const r = x < y ? -1 : 1;
      return s.order === 'desc' ? -r : r;
    }
    return 0;
  });
  const offset = body.offset ?? 0;
  const limit = body.limit ?? 20;
  const results = filtered.slice(offset, offset + limit).map(({ doc, marks }) => ({
    id: doc.id,
    ...(body.markMatchingVariants
      ? { matchingVariants: { allMatched: marks.variants.size === doc.variants.length, matchedVariants: doc.variants.filter((v) => marks.variants.has(v.id)).map((v) => ({ id: v.id, sku: v.sku })) } }
      : {}),
  }));
  return {
    total: filtered.length, offset, limit, results,
    facets: (body.facets ?? []).map((f) => facetOf(f, forFacets)),
  };
}
