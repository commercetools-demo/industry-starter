import { handle, jsonError, requireCustomer } from '@/lib/api';
import {
  createReview, findMyReview, getReviewProducts, listMyReviews, listProductReviews, productExists,
} from '@/lib/ct/reviews';
import { AppError } from '@/lib/errors';
import { toMyReviewView, toReviewView } from '@/lib/mappers/review';
import { AlreadyReviewedError } from '@/lib/reviews/errors';
import { alreadyReviewedResponse, assertWithinLimit, readJson, toMine, validationResponse } from '@/lib/reviews/handler-support';
import { REVIEW_PAGE_SIZE, isProductId, validateReviewInput } from '@/lib/reviews/validate';
import { getMarket, getSession } from '@/lib/session';
import type { ReviewPageResponse, ReviewSort } from '@/lib/types';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const SORTS: readonly ReviewSort[] = ['newest', 'highest', 'lowest'];
const MAX_PAGE = 200;

/**
 * GET /api/reviews?productId=<uuid>&sort=newest|highest|lowest&page=<n> -> 200 ReviewPageResponse (public, five per page,
 * plus `mine` for a signed-in customer). GET /api/reviews?mine=1 -> 200 { reviews: MyReviewView[] } (session).
 * No emails, no customer ids in any answer (D-037: every review is published, so there is no state either).
 */
export const GET = handle('/api/reviews', async (req) => {
  const params = new URL(req.url).searchParams;

  if (params.get('mine') === '1') {
    const { customerId, locale: sessionLocale } = await requireCustomer();
    const { locale } = sessionLocale ? { locale: sessionLocale } : await getMarket();
    const reviews = await listMyReviews(customerId);
    const products = await getReviewProducts(
      reviews.flatMap((r) => (r.target?.typeId === 'product' ? [r.target.id] : [])),
      locale,
    );
    return Response.json(
      { reviews: reviews.map((r) => toMyReviewView(r, r.target ? products.get(r.target.id) : null)) },
      { headers: NO_STORE },
    );
  }

  const productId = params.get('productId');
  const sort = (params.get('sort') ?? 'newest') as ReviewSort;
  const pageParam = params.get('page') ?? '0';
  const page = /^\d{1,3}$/.test(pageParam) ? Number(pageParam) : -1;
  if (!isProductId(productId) || !SORTS.includes(sort) || page < 0 || page > MAX_PAGE) throw new AppError('bad_request', 400);

  const { results, total } = await listProductReviews({ productId, sort, page });
  const { customerId } = await getSession();
  let mine: { id: string } | null = null;
  if (customerId) {
    try {
      const own = await findMyReview(customerId, productId);
      mine = own ? { id: own.id } : null;
    } catch {
      mine = null; // the list still works when the own-review lookup fails
    }
  }
  const body: ReviewPageResponse = {
    reviews: results.map(toReviewView),
    total,
    page,
    pageSize: REVIEW_PAGE_SIZE,
    hasMore: (page + 1) * REVIEW_PAGE_SIZE < total,
    mine,
  };
  return Response.json(body, { headers: NO_STORE });
});

/**
 * POST /api/reviews { productId, rating, title?, text? } -> 201 { review: MyReviewView }. The customer comes from the
 * session only; a `customerId` in the body is ignored. 422 `validation_failed` with `fields`, 404 unknown product,
 * 409 `already_reviewed` with `reviewId`, 429 after 5 in an hour.
 */
export const POST = handle('/api/reviews', async (req) => {
  const session = await requireCustomer();
  const body = await readJson(req);
  const checked = validateReviewInput(body);
  if (!checked.ok) return validationResponse(checked.fields);
  if (!isProductId(body.productId)) throw new AppError('bad_request', 400);
  const { locale } = await getMarket();
  assertWithinLimit('create', session.customerId);
  if (!(await productExists(body.productId, locale))) return jsonError('not_found', 404);
  try {
    const review = await createReview({
      customerId: session.customerId,
      firstName: session.customerFirstName,
      lastName: session.customerLastName,
      locale,
      productId: body.productId,
      input: checked.value,
    });
    return Response.json({ review: await toMine(review, locale) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof AlreadyReviewedError) return alreadyReviewedResponse(e);
    throw e;
  }
});
