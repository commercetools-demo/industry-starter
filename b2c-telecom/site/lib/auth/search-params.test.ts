import { firstParam, returnTargetOf } from './search-params';

describe('auth page search params', () => {
  it('takes the first of repeated values', () => {
    expect(firstParam(['a', 'b'])).toBe('a');
    expect(firstParam('a')).toBe('a');
    expect(firstParam(undefined)).toBeUndefined();
  });

  it('validates returnTo and accepts the older next parameter', () => {
    expect(returnTargetOf({ returnTo: '/en-US/bundle' }, 'en-US')).toBe('/en-US/bundle');
    expect(returnTargetOf({ next: '/account/orders' }, 'de-DE')).toBe('/de-DE/account/orders');
    expect(returnTargetOf({ returnTo: 'https://evil.com' }, 'en-US')).toBe('/en-US/account');
    expect(returnTargetOf({ returnTo: ['//evil.com', '/en-US/bundle'] }, 'en-US')).toBe('/en-US/account');
  });

  it('is undefined without a target', () => {
    expect(returnTargetOf({}, 'en-US')).toBeUndefined();
  });
});
