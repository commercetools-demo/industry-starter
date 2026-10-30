import { describe, expect, it } from 'vitest';
import { pageBuilderMarket, pageBuilderPath } from './context';

describe('pageBuilderMarket', () => {
  it('gives the US market for en-US', () => {
    expect(pageBuilderMarket('en-US')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
  });
  it('gives the Canadian market for en-CA and never a store', () => {
    const m = pageBuilderMarket('en-CA');
    expect(m).toEqual({ locale: 'en-CA', currency: 'CAD', country: 'CA' });
    expect('store' in m).toBe(false);
  });
  it('falls back to the default market for an unknown locale', () => {
    expect(pageBuilderMarket('fr-FR')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
  });
});

describe('pageBuilderPath', () => {
  it('is / for the home page', () => {
    expect(pageBuilderPath([])).toBe('/');
    expect(pageBuilderPath()).toBe('/');
  });
  it('joins the segments after the locale', () => {
    expect(pageBuilderPath(['category', 'pods'])).toBe('/category/pods');
    expect(pageBuilderPath(['about'])).toBe('/about');
  });
  it('ignores empty segments', () => {
    expect(pageBuilderPath(['', 'spring-collection', ''])).toBe('/spring-collection');
  });
});
