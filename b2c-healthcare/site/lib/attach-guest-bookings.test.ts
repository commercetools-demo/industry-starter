// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const readRefs = vi.fn();
vi.mock('@/lib/booking-access', () => ({ readGuestBookingRefs: () => readRefs() }));
const attach = vi.fn();
vi.mock('@/lib/ct/bookings-attach', () => ({ attachGuestBookings: (...a: unknown[]) => attach(...a) }));

import { attachAfterSignIn } from './attach-guest-bookings';

beforeEach(() => {
  readRefs.mockReset().mockResolvedValue(['BK-ABCDEFGHJK']);
  attach.mockReset().mockResolvedValue(1);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('design-account-area: attachAfterSignIn hook', () => {
  it('a verified account passes its email and the cookie references', async () => {
    await attachAfterSignIn({ customerId: 'c1', email: 'sam@example.com', emailVerified: true });
    expect(attach).toHaveBeenCalledWith('c1', 'sam@example.com', ['BK-ABCDEFGHJK']);
  });

  it('an unverified account passes no email: only the cookie path applies', async () => {
    await attachAfterSignIn({ customerId: 'c1', email: 'sam@example.com', emailVerified: false });
    expect(attach).toHaveBeenCalledWith('c1', null, ['BK-ABCDEFGHJK']);
  });

  it('never throws into the sign-in and logs without the email or the booking', async () => {
    attach.mockRejectedValue(Object.assign(new Error('boom for sam@example.com BK-ABCDEFGHJK'), { statusCode: 500 }));
    await expect(attachAfterSignIn({ customerId: 'c1', email: 'sam@example.com', emailVerified: true })).resolves.toBeUndefined();
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain('sam@example.com');
    expect(logged).not.toContain('BK-ABCDEFGHJK');
  });

  it('an unreadable cookie does not stop the email path', async () => {
    readRefs.mockRejectedValue(new Error('no request scope'));
    await attachAfterSignIn({ customerId: 'c1', email: 'sam@example.com', emailVerified: true });
    expect(attach).toHaveBeenCalledWith('c1', 'sam@example.com', []);
  });
});
