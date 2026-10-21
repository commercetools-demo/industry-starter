// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Reviews and orders for the local mock commercetools server (workstream M). A test double, not a spec: it understands the
// three review predicates lib/ct/reviews.ts sends, sorting, offset and limit, create (with the uniquenessValue duplicate
// check), the setRating / setTitle / setText update actions, delete by version, and keeps the product's
// reviewRatingStatistics in step so the product page shows new numbers after a write.
import { DOCS, DOC_BY_ID, FIXTURES } from './mock-catalog.mjs';

const PROJECT = 'mock-project';
const NAMES = ['Priya N.', 'Liam C.', 'Ava M.', 'Noah P.', 'Lucas T.', 'Sam R.', 'Dana K.', 'Jo W.'];
const BY_RATING = {
  5: ['Best pods I have tried', 'Rich, sweet and smooth. Will reorder.'],
  4: ['Really good', 'Great flavour, the crema could be thicker.'],
  3: ['Decent', 'Fine for every day, nothing special.'],
  2: ['Not for me', 'A bit thin and bitter for my taste.'],
  1: ['Disappointed', 'Watery and flat. Would not buy again.'],
};

const DAY = 86400000;
export const REVIEWS = new Map();
let seq = 0;

DOCS.forEach((doc, di) => {
  const ratings = FIXTURES.products[di]?.ratings ?? [];
  ratings.forEach((rating, n) => {
    const id = `rev-seed-${di + 1}-${n + 1}`;
    const [title, text] = BY_RATING[rating];
    REVIEWS.set(id, {
      id, version: 1, key: `mcf-review-mock-${di + 1}-${n + 1}`, authorName: NAMES[(di + n) % NAMES.length], title, text: `${text} (${doc.name['en-US'] ?? 'product'})`,
      rating, locale: n % 3 === 2 ? 'en-CA' : 'en-US', target: { typeId: 'product', id: doc.id }, includedInStatistics: true,
      createdAt: new Date(Date.now() - (n + 1) * 2 * DAY - di * 3600000).toISOString(), lastModifiedAt: new Date().toISOString(),
    });
  });
});

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const notFound = (res) => json(res, 404, { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound' }] });

function recompute(productId) {
  const doc = DOC_BY_ID.get(productId);
  if (!doc) return;
  const ratings = [...REVIEWS.values()].filter((r) => r.target.id === productId && r.includedInStatistics).map((r) => r.rating);
  if (ratings.length === 0) {
    doc.stats = undefined;
    return;
  }
  const dist = {};
  for (const r of ratings) dist[String(r)] = (dist[String(r)] ?? 0) + 1;
  doc.stats = {
    averageRating: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length,
    highestRating: Math.max(...ratings), lowestRating: Math.min(...ratings), ratingsDistribution: dist,
  };
}

function matching(url) {
  const where = url.searchParams.get('where') ?? '';
  const v = (name) => url.searchParams.get(`var.${name}`);
  let list = [...REVIEWS.values()];
  if (where.includes('target(typeId="product" and id=:id)')) list = list.filter((r) => r.target.id === v('id'));
  if (where.includes('target(typeId="product" and id=:p)')) list = list.filter((r) => r.target.id === v('p'));
  if (where.includes('customer(id=:c)')) list = list.filter((r) => r.customer?.id === v('c'));
  if (where.includes('includedInStatistics=true')) list = list.filter((r) => r.includedInStatistics);
  for (const spec of [...url.searchParams.getAll('sort')].reverse()) {
    const [field, dir] = spec.split(' ');
    list.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  // sort() above is applied last-key-first and stable, so the first key wins
  return list;
}

/** Orders: the first demo customer (cust-1, Maya) has one order with the first product, so "Verified purchase" can be tried. */
function orders(url) {
  const c = url.searchParams.get('var.c');
  const p = url.searchParams.get('var.p');
  const has = c === 'cust-1' && p === DOCS[0]?.id;
  const results = has ? [{ id: 'order-mock-1', version: 1, orderNumber: 'MCF-MOCK-1001', customerId: 'cust-1' }] : [];
  return { limit: 1, offset: 0, count: results.length, total: results.length, results };
}

export async function reviewRoutes(req, res, url, path, readBody) {
  if (path === `/${PROJECT}/orders` && req.method === 'GET') return json(res, 200, orders(url));
  if (path === `/${PROJECT}/reviews`) {
    if (req.method === 'GET') {
      const all = matching(url);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const results = all.slice(offset, offset + limit);
      return json(res, 200, { limit, offset, count: results.length, total: all.length, results });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.uniquenessValue && [...REVIEWS.values()].some((r) => r.uniquenessValue === body.uniquenessValue)) {
        return json(res, 400, { statusCode: 400, message: 'duplicate', errors: [{ code: 'DuplicateField', field: 'uniquenessValue' }] });
      }
      seq += 1;
      const now = new Date().toISOString();
      const review = {
        id: `rev-mock-${seq}`, version: 1, ...body, includedInStatistics: typeof body.rating === 'number',
        ...(body.custom ? { custom: { type: { typeId: 'type', id: 'mcf-review-type' }, fields: body.custom.fields } } : {}),
        createdAt: now, lastModifiedAt: now,
      };
      REVIEWS.set(review.id, review);
      recompute(review.target?.id);
      return json(res, 201, review);
    }
  }
  const match = new RegExp(`^/${PROJECT}/reviews/([^/]+)$`).exec(path);
  if (match) {
    const review = REVIEWS.get(match[1]);
    if (!review) return notFound(res);
    if (req.method === 'GET') return json(res, 200, review);
    const conflict = () => json(res, 409, { statusCode: 409, message: 'Object has a different version', errors: [{ code: 'ConcurrentModification' }] });
    if (req.method === 'DELETE') {
      if (Number(url.searchParams.get('version')) !== review.version) return conflict();
      REVIEWS.delete(review.id);
      recompute(review.target.id);
      return json(res, 200, review);
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.version !== review.version) return conflict();
      for (const a of body.actions ?? []) {
        if (a.action === 'setRating') review.rating = a.rating;
        else if (a.action === 'setTitle') review.title = a.title;
        else if (a.action === 'setText') review.text = a.text;
        else return json(res, 400, { statusCode: 400, message: `unsupported action ${a.action}`, errors: [{ code: 'InvalidOperation' }] });
      }
      review.version += 1;
      review.lastModifiedAt = new Date().toISOString();
      recompute(review.target.id);
      return json(res, 200, review);
    }
  }
  return false;
}
