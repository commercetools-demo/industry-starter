import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG } from '@/lib/utils';

describe('test harness', () => {
  it('Fresh clone builds: the test runner starts', () => {
    expect(COUNTRY_CONFIG['en-US'].currency).toBe('USD');
  });
});
