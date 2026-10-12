// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

const session = vi.hoisted(() => ({ value: {} as Record<string, string> }));
const createReview = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getSession: async () => session.value, getLocale: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/reviews', async () => ({ createReview, reviewSubmissionEnabled: () => process.env.REVIEW_SUBMISSION_ENABLED === 'true' }));

import { POST } from './route';

const post = (body: unknown) => POST(new Request('http://localhost/api/reviews', { method: 'POST', body: JSON.stringify(body) }));
const valid = { productId: 'prod1', rating: 5, title: 'Great', text: 'Fits well' };

beforeEach(() => {
  vi.stubEnv('REVIEW_SUBMISSION_ENABLED', 'true');
  session.value = { customerId: 'cust1', storeKey: 'mau-reseller-north' };
  createReview.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/reviews', () => {
  it('creates the review in the store of the session, ignoring a store in the body', async () => {
    createReview.mockResolvedValue({ id: 'r1' });
    const res = await post({ ...valid, storeKey: 'mau-reseller-south' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'r1' });
    expect(createReview).toHaveBeenCalledWith('mau-reseller-north', 'cust1', { ...valid, locale: 'en-US' });
  });
  it('is 404 when reviews are switched off', async () => {
    vi.stubEnv('REVIEW_SUBMISSION_ENABLED', 'false');
    expect((await post(valid)).status).toBe(404);
  });
  it('is 401 when signed out', async () => {
    session.value = { storeKey: 'mau-reseller-north' };
    expect((await post(valid)).status).toBe(401);
    expect(createReview).not.toHaveBeenCalled();
  });
  it('rejects a rating outside 1 to 5 and long text', async () => {
    expect((await post({ ...valid, rating: 6 })).status).toBe(400);
    expect((await post({ ...valid, text: 'x'.repeat(1001) })).status).toBe(400);
    expect((await post({ ...valid, title: 'x'.repeat(81) })).status).toBe(400);
  });
  it('passes the 403 and 409 of the review rules through', async () => {
    createReview.mockRejectedValueOnce(new ApiError(403, 'not-purchased')).mockRejectedValueOnce(new ApiError(409, 'already-reviewed'));
    expect((await post(valid)).status).toBe(403);
    const dup = await post(valid);
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: 'already-reviewed' });
  });
});
