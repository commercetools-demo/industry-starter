import { describe, expect, it } from 'vitest';
import { autoRefillEnabled } from './features';

describe('design-home-page: capability flags', () => {
  it('auto-refill defaults to false and is on only for the exact value "true"', () => {
    expect(autoRefillEnabled({})).toBe(false);
    expect(autoRefillEnabled({ AUTO_REFILL_ENABLED: '' })).toBe(false);
    expect(autoRefillEnabled({ AUTO_REFILL_ENABLED: '1' })).toBe(false);
    expect(autoRefillEnabled({ AUTO_REFILL_ENABLED: ' TRUE ' })).toBe(true);
  });
});
