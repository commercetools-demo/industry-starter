import { describe, expect, it } from 'vitest';
import { BRANDS, DEFAULT_BRAND, brandOf, brandTabs, isBrandSlug } from '@/lib/brands';

describe('brand registry', () => {
  it('knows both brands and rejects anything else', () => {
    expect(isBrandSlug('malva-coffee')).toBe(true);
    expect(isBrandSlug('malva-drinks')).toBe(true);
    expect(isBrandSlug('en-US')).toBe(false);
    expect(isBrandSlug(undefined)).toBe(false);
    expect(isBrandSlug('constructor')).toBe(false);
  });

  it('falls back to the default brand', () => {
    expect(brandOf('nope').slug).toBe(DEFAULT_BRAND);
    expect(brandOf(undefined).slug).toBe('malva-coffee');
  });

  it('puts the current brand first in the tabs', () => {
    expect(brandTabs('malva-drinks').map((b) => b.slug)).toEqual(['malva-drinks', 'malva-coffee']);
    expect(brandTabs('malva-coffee').map((b) => b.slug)).toEqual(['malva-coffee', 'malva-drinks']);
  });

  it('turns pickup off for drinks and gives it its own channel and selection', () => {
    expect(BRANDS['malva-drinks'].pickup).toBe(false);
    expect(BRANDS['malva-coffee'].pickup).toBe(true);
    expect(BRANDS['malva-drinks'].inventoryChannelKey).toBe('mcf-channel-malva-drinks');
    expect(BRANDS['malva-coffee'].inventoryChannelKey).toBeUndefined();
    expect(new Set(Object.values(BRANDS).map((b) => b.productSelectionKey)).size).toBe(2);
  });
});
