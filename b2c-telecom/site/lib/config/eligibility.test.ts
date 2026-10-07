import { CUSTOMER_TYPE_PRIORITY, POSTAL_COOKIE, POSTAL_COOKIE_MAX_AGE, SALES_CHANNEL } from './eligibility';
import { CUSTOMER_GROUPS_TTL, SERVICEABILITY_TTL } from './cache';

describe('eligibility config', () => {
  it('fixes the channel, cookie and cache windows', () => {
    expect(SALES_CHANNEL).toBe('online');
    expect(POSTAL_COOKIE).toBe('malva-postal-code');
    expect(POSTAL_COOKIE_MAX_AGE).toBe(30 * 24 * 3600);
    expect(SERVICEABILITY_TTL).toBe(300);
    expect(CUSTOMER_GROUPS_TTL).toBe(300);
  });

  it('ranks employee over small-business over consumer', () => {
    expect(CUSTOMER_TYPE_PRIORITY).toEqual(['employee', 'small-business', 'consumer']);
  });
});
