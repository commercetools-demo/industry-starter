import { handle, requireCustomer } from '@/lib/api';
import { deleteReview, updateReview } from '@/lib/ct/reviews';
import { assertWithinLimit, readJson, toMine, validationResponse } from '@/lib/reviews/handler-support';
import { validateReviewInput } from '@/lib/reviews/validate';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * PATCH /api/reviews/<id> { rating?, title?, text? } -> 200 { review: MyReviewView }. An edit is live at once (D-037).
 * A foreign review and an unknown id both answer 404 with the same body. 30 writes per hour per customer.
 */
export const PATCH = handle('/api/reviews/[id]', async (req, ctx) => {
  const session = await requireCustomer();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const checked = validateReviewInput(body, { partial: true });
  if (!checked.ok) return validationResponse(checked.fields);
  const { rating, title, text } = checked.value as { rating?: number; title?: string; text?: string };
  if (rating === undefined && title === undefined && text === undefined) return validationResponse({});
  assertWithinLimit('write', session.customerId);
  const review = await updateReview(id, session.customerId, {
    ...(rating !== undefined ? { rating } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(text !== undefined ? { text } : {}),
  });
  const { locale } = await getMarket();
  return Response.json({ review: await toMine(review, locale) }, { headers: NO_STORE });
});

/** DELETE /api/reviews/<id> -> 200 { ok: true }. */
export const DELETE = handle('/api/reviews/[id]', async (_req, ctx) => {
  const session = await requireCustomer();
  const { id } = await ctx.params;
  assertWithinLimit('write', session.customerId);
  await deleteReview(id, session.customerId);
  return Response.json({ ok: true }, { headers: NO_STORE });
});
