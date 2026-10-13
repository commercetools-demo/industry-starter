// Reviews of the store (workstream V-16). `Review` resources carry the custom type `malva-review` (`storeKey`, `replyText`, `replyAt`,
// `replyBy`) and the states `review-published` (role `ReviewIncludedInStatistics`) and `review-hidden`. The storefront writes a
// review with the store key of the shopper's session (storefront/lib/ct/reviews.ts); the portal lists only the store's own and replies
// or hides after checking the review's `custom.fields.storeKey`. Seeded reviews have no store and are not listed here.
// `replyBy` is the store's display name: the storefront shows "Reply from {replyBy ?? store name}".
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import type { ReviewList, ReviewRow, ReviewTab, ReviewVisibility } from '@/lib/v-types';
import { vRoot } from './v-root';
import { retryOnConflict, statusOf } from './versioned';

export const REVIEW_PUBLISHED_STATE = 'review-published';
export const REVIEW_HIDDEN_STATE = 'review-hidden';
export const REPLY_MAX = 1000;
const clean = (v: string) => v.replace(/["\\]/g, '');

interface ReviewLike {
  id: string;
  version: number;
  createdAt: string;
  authorName?: string;
  title?: string;
  text?: string;
  rating?: number;
  target?: { id: string; obj?: { masterData?: { current?: { name?: Record<string, string> } } } };
  state?: { obj?: { key?: string } };
  custom?: { fields?: Record<string, unknown> };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

export function mapReview(r: ReviewLike, locale = 'en-US'): ReviewRow {
  const fields = r.custom?.fields;
  const replyText = str(fields?.replyText);
  const name = r.target?.obj?.masterData?.current?.name;
  return {
    id: r.id,
    productId: r.target?.id ?? '',
    productName: (name && (name[locale] ?? Object.values(name)[0])) || r.target?.id || '',
    rating: typeof r.rating === 'number' ? r.rating : 0,
    title: r.title ?? '',
    text: r.text ?? '',
    author: r.authorName ?? '',
    createdAt: r.createdAt,
    visibility: r.state?.obj?.key === REVIEW_HIDDEN_STATE ? 'hidden' : 'published',
    reply: replyText ? { text: replyText, at: str(fields?.replyAt) ?? null, by: str(fields?.replyBy) ?? null } : null,
  };
}

/** Average of the visible ratings (one decimal), the reviews of this calendar month and the visible ones without a reply. */
export function summarizeReviews(rows: ReviewRow[], now: Date = new Date()): ReviewList['kpis'] {
  const visible = rows.filter((r) => r.visibility === 'published');
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return {
    average: visible.length === 0 ? 0 : Math.round((visible.reduce((s, r) => s + r.rating, 0) / visible.length) * 10) / 10,
    thisMonth: visible.filter((r) => Date.parse(r.createdAt) >= monthStart).length,
    unanswered: visible.filter((r) => r.reply === null).length,
  };
}

const SORTS: Record<ReviewTab, string> = { latest: 'createdAt desc', highest: 'rating desc', lowest: 'rating asc' };

export async function listReviews(storeKey: string, tab: ReviewTab = 'latest', locale = 'en-US', now: Date = new Date()): Promise<ReviewList> {
  const root = await vRoot();
  const { body } = await root
    .reviews()
    .get({ queryArgs: { where: `custom(fields(storeKey="${clean(storeKey)}"))`, expand: ['state', 'target'], sort: SORTS[tab], limit: 100, withTotal: true } })
    .execute();
  const rows = (body.results as unknown as ReviewLike[]).map((r) => mapReview(r, locale));
  return { rows, kpis: summarizeReviews(rows, now) };
}

/** The review, only when it belongs to the store (else 404, the same as a missing id). */
async function loadOwn(storeKey: string, id: string): Promise<ReviewLike> {
  const root = await vRoot();
  try {
    const { body } = await root.reviews().withId({ ID: id }).get().execute();
    const review = body as unknown as ReviewLike;
    if (review.custom?.fields?.storeKey !== storeKey) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
    return review;
  } catch (error) {
    if (statusOf(error) === 404) throw new CatalogError(404, 'NOT_FOUND', 'Not found');
    throw error;
  }
}

export async function replyToReview(storeKey: string, id: string, text: string, by: string, now: Date = new Date()): Promise<{ id: string }> {
  const reply = text.trim();
  if (reply.length === 0 || reply.length > REPLY_MAX) throw new CatalogError(400, 'REPLY_INVALID', `The reply must have 1 to ${REPLY_MAX} characters`);
  const root = await vRoot();
  await retryOnConflict(async () => {
    const review = await loadOwn(storeKey, id);
    await root
      .reviews()
      .withId({ ID: id })
      .post({
        body: {
          version: review.version,
          actions: [
            { action: 'setCustomField', name: 'replyText', value: reply },
            { action: 'setCustomField', name: 'replyAt', value: now.toISOString() },
            { action: 'setCustomField', name: 'replyBy', value: by },
          ],
        },
      })
      .execute();
  }, 3);
  return { id };
}

/** Publish or hide through the review states (`transitionState`, forced because the seed defines no transitions between them). */
export async function setVisibility(storeKey: string, id: string, visibility: ReviewVisibility): Promise<{ id: string; visibility: ReviewVisibility }> {
  const root = await vRoot();
  const key = visibility === 'hidden' ? REVIEW_HIDDEN_STATE : REVIEW_PUBLISHED_STATE;
  await retryOnConflict(async () => {
    const review = await loadOwn(storeKey, id);
    await root
      .reviews()
      .withId({ ID: id })
      .post({ body: { version: review.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key }, force: true }] } })
      .execute();
  }, 3);
  return { id, visibility };
}
