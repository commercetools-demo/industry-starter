import 'server-only';
import { apiRoot } from '@/lib/ct/client';

/** A review from a verified patient (custom field `verifiedPatient`, type `mlv-review-meta`). */
export interface VerifiedReview {
  id: string;
  rating: number;
  title?: string;
  text?: string;
  authorName?: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface RatingStatistics {
  averageRating: number;
  count: number;
  /** star value -> number of reviews with it (absent star = none). */
  ratingsDistribution: Record<string, number>;
}

const SAFE_ID = /^[\w-]+$/;

/** Verified reviews of a product, newest first. Unverified reviews are never returned. */
export async function listVerifiedReviews(productId: string, limit = 20, offset = 0): Promise<VerifiedReview[]> {
  if (!SAFE_ID.test(productId)) return [];
  const { body } = await apiRoot
    .reviews()
    .get({
      queryArgs: {
        where: `target(typeId="product" and id="${productId}") and includedInStatistics=true and custom(fields(verifiedPatient=true))`,
        sort: 'createdAt desc',
        limit,
        offset,
      },
    })
    .execute();
  return body.results
    .filter((r) => (r.custom?.fields as { verifiedPatient?: boolean } | undefined)?.verifiedPatient === true)
    .map((r) => ({
      id: r.id,
      rating: r.rating ?? 0,
      ...(r.title ? { title: r.title } : {}),
      ...(r.text ? { text: r.text } : {}),
      ...(r.authorName ? { authorName: r.authorName } : {}),
      createdAt: r.createdAt,
    }));
}

/**
 * Rating statistics as the platform rolls them up on the product projection (`reviewRatingStatistics`).
 * Null when the product has no counted reviews or does not exist.
 */
export async function getRatingStatistics(productId: string): Promise<RatingStatistics | null> {
  if (!SAFE_ID.test(productId)) return null;
  try {
    const { body } = await apiRoot.productProjections().withId({ ID: productId }).get({ queryArgs: { staged: false } }).execute();
    const s = body.reviewRatingStatistics;
    if (!s || s.count === 0) return null;
    return { averageRating: s.averageRating, count: s.count, ratingsDistribution: { ...s.ratingsDistribution } };
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}
