// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { addBookingRef, bookingCookieOptions, MAX_BOOKING_REFS, signBookingRefs, verifyBookingRefs } from './booking-access-core';
import { signSession } from './session-core';

const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
const ref = (n: number) => `BK-${String(n).padStart(10, 'A').replace(/[^A-Z0-9]/g, 'B')}`;

describe('design-pdp: guest booking cookie (core)', () => {
  it('round-trips a list of references', async () => {
    const token = await signBookingRefs(['BK-ABCDEFGHJK', 'BK-KJHGFEDCBA'], SECRET);
    expect(await verifyBookingRefs(token, SECRET)).toEqual(['BK-ABCDEFGHJK', 'BK-KJHGFEDCBA']);
  });

  it('a tampered, foreign-secret, missing or garbage cookie is an empty list', async () => {
    const token = await signBookingRefs(['BK-ABCDEFGHJK'], SECRET);
    expect(await verifyBookingRefs(`${token}x`, SECRET)).toEqual([]);
    expect(await verifyBookingRefs(token, 'another-secret-that-is-at-least-32-characters')).toEqual([]);
    expect(await verifyBookingRefs(undefined, SECRET)).toEqual([]);
    expect(await verifyBookingRefs('not.a.jwt', SECRET)).toEqual([]);
  });

  it('the session token cannot be used as a booking cookie', async () => {
    expect(await verifyBookingRefs(await signSession({ customerId: 'c1' }, SECRET), SECRET)).toEqual([]);
  });

  it('only well-formed references are signed or read back', async () => {
    const token = await signBookingRefs(['BK-ABCDEFGHJK', 'bk-lowercase', '../x', 'BK-SHORT'], SECRET);
    expect(await verifyBookingRefs(token, SECRET)).toEqual(['BK-ABCDEFGHJK']);
  });

  it('the cookie carries references only', async () => {
    const token = await signBookingRefs(['BK-ABCDEFGHJK'], SECRET);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'refs']);
  });

  it('addBookingRef de-duplicates, ignores a malformed reference and keeps the newest', () => {
    expect(addBookingRef(['BK-ABCDEFGHJK'], 'BK-ABCDEFGHJK')).toEqual(['BK-ABCDEFGHJK']);
    expect(addBookingRef(['BK-ABCDEFGHJK'], 'nope')).toEqual(['BK-ABCDEFGHJK']);
    let refs: string[] = [];
    for (let i = 0; i < MAX_BOOKING_REFS + 5; i += 1) refs = addBookingRef(refs, ref(i));
    expect(refs).toHaveLength(MAX_BOOKING_REFS);
    expect(refs.at(-1)).toBe(ref(MAX_BOOKING_REFS + 4));
  });

  it('the cookie is HTTP-only, Lax and Secure outside development', () => {
    expect(bookingCookieOptions('production')).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
    expect(bookingCookieOptions('development').secure).toBe(false);
  });
});
