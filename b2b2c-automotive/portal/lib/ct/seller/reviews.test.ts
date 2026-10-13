import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVFake, type VFake } from '@/lib/portal/v-fixture-root';
import { listReviews, replyToReview, setVisibility } from './reviews';
import { setVRootForTest } from './v-root';

const NOW = new Date('2026-10-12T10:00:00Z');
let fake: VFake;

beforeEach(() => {
  fake = createVFake({ now: () => NOW, demo: true });
  setVRootForTest(fake.root);
});
afterEach(() => setVRootForTest(undefined));

describe('review reply scope', () => {
  it('lists only the store reviews with the rating summary of the visible ones', async () => {
    const list = await listReviews('fx-store-online', 'latest', 'en-US', NOW);
    expect(list.rows.every((r) => ['fx-review-1', 'fx-review-2', 'fx-review-3', 'fx-review-4'].includes(r.id))).toBe(true);
    // 5, 2 and 4 are visible; the hidden 1-star review is left out of the average.
    expect(list.kpis).toMatchObject({ average: 3.7, unanswered: 2 });
    expect((await listReviews('fx-store-online', 'highest', 'en-US', NOW)).rows[0].rating).toBe(5);
    expect((await listReviews('fx-store-online', 'lowest', 'en-US', NOW)).rows[0].rating).toBe(1);
  });

  it('replying to a review of another store is 404 and nothing is written', async () => {
    await expect(replyToReview('fx-store-south', 'fx-review-2', 'Thanks', 'South', NOW)).rejects.toMatchObject({ status: 404 });
    await expect(setVisibility('fx-store-south', 'fx-review-2', 'hidden')).rejects.toMatchObject({ status: 404 });
    expect(fake.calls.filter((c) => c.op === 'review.update')).toHaveLength(0);
  });

  it('a reply over 1,000 characters is refused (400); an empty one too', async () => {
    await expect(replyToReview('fx-store-online', 'fx-review-2', 'x'.repeat(1001), 'Shop', NOW)).rejects.toMatchObject({ status: 400 });
    await expect(replyToReview('fx-store-online', 'fx-review-2', '   ', 'Shop', NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('a reply stores text, time and the store name, and the unanswered count drops', async () => {
    const before = (await listReviews('fx-store-online', 'latest', 'en-US', NOW)).kpis.unanswered;
    await replyToReview('fx-store-online', 'fx-review-2', ' Sorry about that ', 'DACH Online', NOW);
    const list = await listReviews('fx-store-online', 'latest', 'en-US', NOW);
    expect(list.kpis.unanswered).toBe(before - 1);
    expect(list.rows.find((r) => r.id === 'fx-review-2')?.reply).toEqual({ text: 'Sorry about that', at: NOW.toISOString(), by: 'DACH Online' });
  });

  it('hide and publish move the review state; a hidden review leaves the statistics', async () => {
    await setVisibility('fx-store-online', 'fx-review-2', 'hidden');
    let list = await listReviews('fx-store-online', 'latest', 'en-US', NOW);
    expect(list.rows.find((r) => r.id === 'fx-review-2')?.visibility).toBe('hidden');
    expect(list.kpis.average).toBe(4.5);
    await setVisibility('fx-store-online', 'fx-review-2', 'published');
    list = await listReviews('fx-store-online', 'latest', 'en-US', NOW);
    expect(list.rows.find((r) => r.id === 'fx-review-2')?.visibility).toBe('published');
    expect(fake.calls.filter((c) => c.op === 'review.update')[0].args).toMatchObject({ actions: [{ action: 'transitionState', state: { key: 'review-hidden' } }] });
  });
});
