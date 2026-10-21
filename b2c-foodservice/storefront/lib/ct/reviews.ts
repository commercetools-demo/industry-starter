import 'server-only';
import type { Review, ReviewUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { reviewWriteRoot } from '@/lib/ct/review-client';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { AlreadyReviewedError } from '@/lib/reviews/errors';
import { REVIEW_PAGE_SIZE, authorName, isProductId, type ValidReview } from '@/lib/reviews/validate';
import { getLocalizedString } from '@/lib/utils';
import type { ReviewSort } from '@/lib/types';

/** `queryArgs.sort` per sort choice (workstream M, 3.4). */
export const REVIEW_SORT: Record<ReviewSort, string[]> = {
  newest: ['createdAt desc'],
  highest: ['rating desc', 'createdAt desc'],
  lowest: ['rating asc', 'createdAt desc'],
};

const notFound = () => new AppError('not_found', 404);
const badId = (id: string) => !/^[A-Za-z0-9-]{1,64}$/.test(id);

/**
 * Published reviews of one product, five per page. Every public query carries `includedInStatistics=true` (a review
 * with no state is included at once, D-037). The product id is a query variable, never concatenated.
 */
export async function listProductReviews(args: {
  productId: string; sort: ReviewSort; page: number;
}): Promise<{ results: Review[]; total: number }> {
  if (!isProductId(args.productId)) throw new AppError('bad_request', 400);
  const { body } = await apiRoot
    .reviews()
    .get({
      queryArgs: {
        where: 'target(typeId="product" and id=:id) and includedInStatistics=true',
        'var.id': args.productId,
        sort: REVIEW_SORT[args.sort],
        limit: REVIEW_PAGE_SIZE,
        offset: args.page * REVIEW_PAGE_SIZE,
        withTotal: true,
      },
    })
    .execute();
  return { results: body.results, total: body.total ?? body.results.length };
}

/** Every review of the customer, newest first (at most 100). */
export async function listMyReviews(customerId: string): Promise<Review[]> {
  const { body } = await apiRoot
    .reviews()
    .get({ queryArgs: { where: 'customer(id=:c)', 'var.c': customerId, sort: ['createdAt desc'], limit: 100 } })
    .execute();
  return body.results;
}

export async function findMyReview(customerId: string, productId: string): Promise<Review | null> {
  if (!isProductId(productId)) throw new AppError('bad_request', 400);
  const { body } = await apiRoot
    .reviews()
    .get({
      queryArgs: {
        where: 'customer(id=:c) and target(typeId="product" and id=:p)',
        'var.c': customerId,
        'var.p': productId,
        limit: 1,
      },
    })
    .execute();
  return body.results[0] ?? null;
}

export interface ReviewProduct { id: string; name: string; slug: string; sku: string | null; imageUrl: string | null }

/** Name, slug, first SKU and clean image URL of published products, one call for the distinct ids. */
export async function getReviewProducts(ids: string[], locale: string): Promise<Map<string, ReviewProduct>> {
  const valid = [...new Set(ids)].filter(isProductId);
  const out = new Map<string, ReviewProduct>();
  if (valid.length === 0) return out;
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `id in (${valid.map((_, i) => `:p${i}`).join(',')})`,
        ...Object.fromEntries(valid.map((id, i) => [`var.p${i}`, id])),
        staged: false,
        limit: valid.length,
        localeProjection: [locale],
      },
    })
    .execute();
  for (const p of body.results) {
    out.set(p.id, {
      id: p.id,
      name: getLocalizedString(p.name, locale),
      slug: getLocalizedString(p.slug, locale),
      sku: p.masterVariant.sku ?? null,
      imageUrl: p.masterVariant.images?.[0]?.url ?? null,
    });
  }
  return out;
}

/** True when the product exists and is published. */
export async function productExists(productId: string, locale: string): Promise<boolean> {
  return (await getReviewProducts([productId], locale)).has(productId);
}

/** The order number of the customer's first order that contains the product, or null (evaluated at write time only). */
export async function findPurchase(customerId: string, productId: string): Promise<string | null> {
  const { body } = await apiRoot
    .orders()
    .get({
      queryArgs: {
        where: 'customerId=:c and lineItems(productId=:p)',
        'var.c': customerId,
        'var.p': productId,
        limit: 1,
      },
    })
    .execute();
  const order = body.results[0];
  return order ? (order.orderNumber ?? order.id) : null;
}

const reviewKey = (): string => {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `rev-${rand}-${stamp}`;
};

const isDuplicate = (e: unknown): boolean => {
  const body = (e as { body?: { errors?: { code?: string }[] } } | null)?.body;
  return Boolean(body?.errors?.some((x) => x.code === 'DuplicateField'));
};

export interface CreateReviewArgs {
  customerId: string;
  firstName?: string;
  lastName?: string;
  locale: string;
  productId: string;
  input: ValidReview;
}

/**
 * Creates a published review: no `state`, so it counts in the statistics at once (D-037). One per customer and product:
 * a pre-check plus `uniquenessValue` of `<customerId>:<productId>`. Written with the isolated second client (D-027).
 */
export async function createReview(args: CreateReviewArgs): Promise<Review> {
  if (!isProductId(args.productId)) throw new AppError('bad_request', 400);
  const existing = await findMyReview(args.customerId, args.productId);
  if (existing) throw new AlreadyReviewedError(existing.id);
  const orderNumber = await findPurchase(args.customerId, args.productId);
  const { input } = args;
  try {
    const { body } = await reviewWriteRoot()
      .reviews()
      .post({
        body: {
          key: reviewKey(),
          uniquenessValue: `${args.customerId}:${args.productId}`,
          locale: args.locale,
          authorName: authorName(args.firstName, args.lastName),
          ...(input.title ? { title: input.title } : {}),
          ...(input.text ? { text: input.text } : {}),
          rating: input.rating,
          target: { typeId: 'product', id: args.productId },
          customer: { typeId: 'customer', id: args.customerId },
          custom: {
            type: { typeId: 'type', key: 'mcf-review' },
            fields: { verifiedPurchase: orderNumber !== null, ...(orderNumber ? { orderNumber } : {}) },
          },
        },
      })
      .execute();
    return body;
  } catch (e) {
    if (isDuplicate(e)) {
      const again = await findMyReview(args.customerId, args.productId).catch(() => null);
      throw new AlreadyReviewedError(again?.id ?? null);
    }
    throw e;
  }
}

async function readOwned(id: string, customerId: string): Promise<Review> {
  if (badId(id)) throw notFound();
  let review: Review;
  try {
    review = (await apiRoot.reviews().withId({ ID: id }).get().execute()).body;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) throw notFound();
    throw e;
  }
  // A foreign review and an unknown id are indistinguishable to the caller.
  if (review.customer?.id !== customerId) throw notFound();
  return review;
}

/** Edit: only the changed fields, never a state action (an edit is live at once). */
export async function updateReview(
  id: string,
  customerId: string,
  patch: { rating?: number; title?: string; text?: string },
): Promise<Review> {
  return updateWithRetry(
    () => readOwned(id, customerId),
    async (current) => {
      const actions: ReviewUpdateAction[] = [];
      if (patch.rating !== undefined && patch.rating !== current.rating) actions.push({ action: 'setRating', rating: patch.rating });
      if (patch.title !== undefined && patch.title !== (current.title ?? '')) actions.push({ action: 'setTitle', title: patch.title });
      if (patch.text !== undefined && patch.text !== (current.text ?? '')) actions.push({ action: 'setText', text: patch.text });
      if (actions.length === 0) return current;
      const { body } = await reviewWriteRoot()
        .reviews()
        .withId({ ID: id })
        .post({ body: { version: current.version, actions } })
        .execute();
      return body;
    },
  );
}

export async function deleteReview(id: string, customerId: string): Promise<void> {
  await updateWithRetry(
    () => readOwned(id, customerId),
    async (current) => {
      await reviewWriteRoot().reviews().withId({ ID: id }).delete({ queryArgs: { version: current.version } }).execute();
    },
  );
}
