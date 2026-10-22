// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Review } from '@commercetools/platform-sdk';

const PID = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f';
const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({
  listProductReviews: vi.fn(), listMyReviews: vi.fn(), findMyReview: vi.fn(), getReviewProducts: vi.fn(),
  productExists: vi.fn(), createReview: vi.fn(), updateReview: vi.fn(), deleteReview: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/reviews', () => ct);

import { DELETE, PATCH } from '@/app/api/reviews/[id]/route';
import { GET, POST } from '@/app/api/reviews/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { AlreadyReviewedError } from '@/lib/reviews/errors';
import { SESSION_COOKIE, createSessionToken, type Session } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const review = (over: Partial<Review> = {}): Review =>
  ({
    id: 'r1', version: 2, createdAt: '2026-10-01T10:00:00.000Z', rating: 4, title: 'Good', text: 'Nice', authorName: 'Maya O.',
    locale: 'en-US', includedInStatistics: true, customer: { typeId: 'customer', id: 'c1' }, target: { typeId: 'product', id: PID }, ...over,
  }) as Review;

async function signIn(customerId = 'c1') {
  const s: Session = { customerId, customerFirstName: 'Maya', customerLastName: 'Okonkwo', customerEmail: 'maya@example.com' };
  jar.store.set(SESSION_COOKIE, await createSessionToken(s));
}
const req = (method: string, body?: unknown, url = 'http://x/api/reviews') =>
  new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => {
  jar.store.clear();
  resetRateLimits();
  for (const f of Object.values(ct)) f.mockReset();
  ct.getReviewProducts.mockResolvedValue(new Map());
  ct.productExists.mockResolvedValue(true);
  ct.listProductReviews.mockResolvedValue({ results: [review()], total: 12 });
  ct.findMyReview.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/reviews', () => {
  it('Valid review', async () => {
    await signIn();
    ct.createReview.mockResolvedValue(review({ id: 'new' }));
    const res = await POST(req('POST', { productId: PID, rating: 4, text: 'Great' }), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.review).toMatchObject({ id: 'new', rating: 4 });
    expect(body.review).not.toHaveProperty('state');
    expect(ct.createReview.mock.calls[0][0]).toMatchObject({ customerId: 'c1', firstName: 'Maya', lastName: 'Okonkwo', productId: PID });
  });

  it('Duplicate', async () => {
    await signIn();
    ct.createReview.mockRejectedValue(new AlreadyReviewedError('r-old'));
    const res = await POST(req('POST', { productId: PID, rating: 4 }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'already_reviewed', reviewId: 'r-old' });
  });

  it('Missing rating', async () => {
    await signIn();
    const res = await POST(req('POST', { productId: PID, text: 'x' }), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'validation_failed', fields: { rating: 'rating_required' } });
    expect(ct.createReview).not.toHaveBeenCalled();
    expect(ct.productExists).not.toHaveBeenCalled();
  });

  it('Rate limit on create', async () => {
    await signIn();
    ct.createReview.mockResolvedValue(review());
    for (let i = 0; i < 5; i++) expect((await POST(req('POST', { productId: PID, rating: 5 }), ctx)).status).toBe(201);
    const sixth = await POST(req('POST', { productId: PID, rating: 5 }), ctx);
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await sixth.json()).error.code).toBe('rate_limited');
  });

  it('Unauthenticated write returns 401 with no detail', async () => {
    const res = await POST(req('POST', { productId: PID, rating: 5 }), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
    expect((await PATCH(req('PATCH', { rating: 1 }), idCtx('r1'))).status).toBe(401);
    expect((await DELETE(req('DELETE'), idCtx('r1'))).status).toBe(401);
  });

  it('Review for an unknown product is 404', async () => {
    await signIn();
    ct.productExists.mockResolvedValue(false);
    const res = await POST(req('POST', { productId: PID, rating: 5 }), ctx);
    expect(res.status).toBe(404);
    expect(ct.createReview).not.toHaveBeenCalled();
  });

  it('a product id that is not a UUID is a bad request', async () => {
    await signIn();
    const res = await POST(req('POST', { productId: 'x" or 1=1', rating: 5 }), ctx);
    expect(res.status).toBe(400);
  });

  it('Customer id in the body is ignored', async () => {
    await signIn('c1');
    ct.createReview.mockResolvedValue(review());
    await POST(req('POST', { productId: PID, rating: 5, customerId: 'victim', customer: { id: 'victim' }, authorName: 'Evil' }), ctx);
    const args = ct.createReview.mock.calls[0][0];
    expect(args.customerId).toBe('c1');
    expect(JSON.stringify(args)).not.toContain('victim');
    expect(JSON.stringify(args)).not.toContain('Evil');
  });

  it('Handlers return no commercetools body on 5xx', async () => {
    await signIn();
    ct.createReview.mockRejectedValue({ statusCode: 500, message: 'secret upstream text', body: { errors: [{ detail: 'leak' }] } });
    const res = await POST(req('POST', { productId: PID, rating: 5 }), ctx);
    expect(res.status).toBeGreaterThanOrEqual(500);
    const text = await res.text();
    expect(text).not.toContain('secret upstream text');
    expect(text).not.toContain('leak');
  });
});

describe('GET /api/reviews', () => {
  const url = (q: string) => `http://x/api/reviews?${q}`;

  it('Public list works without a session', async () => {
    const res = await GET(req('GET', undefined, url(`productId=${PID}&sort=lowest&page=1`)), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ total: 12, page: 1, pageSize: 5, hasMore: true, mine: null });
    expect(ct.listProductReviews).toHaveBeenCalledWith({ productId: PID, sort: 'lowest', page: 1 });
    expect(Object.keys(body.reviews[0]).sort()).toEqual(
      ['authorName', 'createdAt', 'id', 'locale', 'rating', 'text', 'title', 'verifiedPurchase'],
    );
    expect(JSON.stringify(body)).not.toMatch(/maya@example|"c1"|customer/);
  });

  it('the last page has no more', async () => {
    const res = await GET(req('GET', undefined, url(`productId=${PID}&page=2`)), ctx);
    expect((await res.json()).hasMore).toBe(false);
  });

  it('Duplicate: the signed-in list marks mine', async () => {
    await signIn();
    ct.findMyReview.mockResolvedValue(review({ id: 'r-mine' }));
    const body = await (await GET(req('GET', undefined, url(`productId=${PID}`)), ctx)).json();
    expect(body.mine).toEqual({ id: 'r-mine' });
  });

  it('bad parameters are 400 and reach no commercetools call', async () => {
    for (const q of ['', 'productId=nope', `productId=${PID}&sort=best`, `productId=${PID}&page=-1`, `productId=${PID}&page=201`, `productId=${PID}&page=abc`]) {
      const res = await GET(req('GET', undefined, url(q)), ctx);
      expect(res.status, q).toBe(400);
    }
    expect(ct.listProductReviews).not.toHaveBeenCalled();
  });

  it('Own list needs a session', async () => {
    const res = await GET(req('GET', undefined, url('mine=1')), ctx);
    expect(res.status).toBe(401);
    await signIn();
    ct.listMyReviews.mockResolvedValue([review()]);
    const ok = await GET(req('GET', undefined, url('mine=1')), ctx);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.reviews[0]).toMatchObject({ id: 'r1', version: 2, product: null });
    expect(ct.listMyReviews).toHaveBeenCalledWith('c1');
  });
});

describe('PATCH and DELETE /api/reviews/[id]', () => {
  const notFound = Object.assign(new Error('nf'), { status: 404, code: 'not_found', name: 'AppError' });

  it('Edit: an edit stays published', async () => {
    await signIn();
    ct.updateReview.mockResolvedValue(review({ text: 'Updated' }));
    const res = await PATCH(req('PATCH', { text: 'Updated' }), idCtx('r1'));
    expect(res.status).toBe(200);
    expect((await res.json()).review.text).toBe('Updated');
    expect(ct.updateReview).toHaveBeenCalledWith('r1', 'c1', { text: 'Updated' });
  });

  it('an empty patch is refused', async () => {
    await signIn();
    expect((await PATCH(req('PATCH', {}), idCtx('r1'))).status).toBe(422);
    expect(ct.updateReview).not.toHaveBeenCalled();
  });

  it('Two customers cannot edit or delete each other\'s review', async () => {
    const { AppError } = await import('@/lib/errors');
    await signIn('c2');
    ct.updateReview.mockRejectedValue(new AppError('not_found', 404));
    ct.deleteReview.mockRejectedValue(new AppError('not_found', 404));
    const a = await PATCH(req('PATCH', { rating: 1 }), idCtx('r1'));
    const b = await DELETE(req('DELETE'), idCtx('r1'));
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(ct.updateReview).toHaveBeenCalledWith('r1', 'c2', { rating: 1 });
    expect(ct.deleteReview).toHaveBeenCalledWith('r1', 'c2');
    void notFound;
  });

  it('Delete', async () => {
    await signIn();
    ct.deleteReview.mockResolvedValue(undefined);
    const res = await DELETE(req('DELETE'), idCtx('r1'));
    expect(await res.json()).toEqual({ ok: true });
  });

  it('30 writes per hour, the 31st is 429', async () => {
    await signIn();
    ct.deleteReview.mockResolvedValue(undefined);
    for (let i = 0; i < 30; i++) expect((await DELETE(req('DELETE'), idCtx('r1'))).status).toBe(200);
    expect((await DELETE(req('DELETE'), idCtx('r1'))).status).toBe(429);
  });
});
