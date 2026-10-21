import { handle, requireCustomer } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { loadSavedList } from '@/lib/account/saved';
import { ListFullError, MAX_LIST_LINES, addProducts, cartProductIds, findList, removeProduct, type SaveRequest } from '@/lib/ct/shopping-lists';
import { AppError } from '@/lib/errors';
import { isProductId } from '@/lib/reviews/validate';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/shopping-lists[?view=ids] -> 200 { list: { id, version, items } | null }. Items are newest first with a card (price
 * in the shopper's market, read from the product, not the list). `view=ids` skips the product read (the hearts use it).
 * 401 with no detail; the list is always the session customer's.
 */
export const GET = handle('/api/shopping-lists', async (req) => {
  const { customerId } = await requireCustomer();
  const idsOnly = new URL(req.url).searchParams.get('view') === 'ids';
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  return Response.json({ list: await loadSavedList(customerId, session, market, { withProducts: !idsOnly }) }, { headers: NO_STORE });
});

/**
 * POST /api/shopping-lists { productId, variantId? } | { fromCart: true } | { merge: string[] } -> 200 { list } (ids view).
 * `merge` takes the product ids of the guest's sessionStorage heart list after sign-in; duplicates and invalid ids are
 * ignored. `fromCart` saves the products of the bag when the list is still empty. 422 validation_failed, 409 list_full
 * (250 lines).
 */
export const POST = handle('/api/shopping-lists', async (req) => {
  const { customerId } = await requireCustomer();
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return domainError('invalid_request', 400);

  let requests: SaveRequest[];
  if (Array.isArray(raw.merge)) {
    requests = [...new Set(raw.merge.filter(isProductId))].slice(0, MAX_LIST_LINES).map((productId) => ({ productId }));
  } else if (raw.fromCart === true) {
    if ((await findList(customerId))?.lineItems.length) throw new AppError('validation_failed', 422);
    requests = (await cartProductIds(await getSession())).map((productId) => ({ productId }));
  } else if (isProductId(raw.productId)) {
    const variantId = raw.variantId;
    if (variantId !== undefined && (typeof variantId !== 'number' || !Number.isInteger(variantId) || variantId < 1)) {
      throw new AppError('validation_failed', 422);
    }
    requests = [{ productId: raw.productId, ...(variantId !== undefined ? { variantId } : {}) }];
  } else {
    throw new AppError('validation_failed', 422);
  }

  try {
    await addProducts(customerId, requests);
  } catch (e) {
    if (e instanceof ListFullError) return domainError('list_full', 409);
    throw e;
  }
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  return Response.json({ list: await loadSavedList(customerId, session, market, { withProducts: false }) }, { headers: NO_STORE });
});

/** DELETE /api/shopping-lists?productId=<id> -> 200 { list }. A product that is not saved changes nothing. */
export const DELETE = handle('/api/shopping-lists', async (req) => {
  const { customerId } = await requireCustomer();
  const productId = new URL(req.url).searchParams.get('productId');
  if (!isProductId(productId)) throw new AppError('validation_failed', 422);
  await removeProduct(customerId, productId);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  return Response.json({ list: await loadSavedList(customerId, session, market, { withProducts: false }) }, { headers: NO_STORE });
});
