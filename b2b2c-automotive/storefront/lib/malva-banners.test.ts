// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { parseMalvaBanners } from '@/lib/malva-banners';

const banner = (over: Record<string, unknown> = {}) => ({
  headline: { de: 'Bremsen', en: 'Brakes' },
  subline: { de: 'Beläge', en: 'Pads' },
  categorySlug: { de: 'bremsen', en: 'brakes' },
  image: { url: 'https://placehold.co/1600x600.jpg', dimensions: { w: 1600, h: 600 } },
  ...over,
});

describe('parseMalvaBanners', () => {
  it('localises headline, subline and category slug', () => {
    expect(parseMalvaBanners({ banners: [banner()] }, 'en-US')).toEqual([{ headline: 'Brakes', subline: 'Pads', categorySlug: 'brakes', image: { url: 'https://placehold.co/1600x600.jpg', width: 1600, height: 600 } }]);
    expect(parseMalvaBanners({ banners: [banner()] }, 'de-DE')[0]).toMatchObject({ headline: 'Bremsen', categorySlug: 'bremsen' });
  });
  it('a missing object or a malformed value gives no banners', () => {
    expect(parseMalvaBanners(null, 'en-US')).toEqual([]);
    expect(parseMalvaBanners({ banners: 'x' }, 'en-US')).toEqual([]);
    expect(parseMalvaBanners({}, 'en-US')).toEqual([]);
  });
  it('a banner without a headline is dropped', () => {
    expect(parseMalvaBanners({ banners: [banner({ headline: {} }), banner()] }, 'en-US')).toHaveLength(1);
  });
  it('a missing, non-https or malformed image gives a text-only banner', () => {
    for (const image of [undefined, { url: 'http://x.test/a.jpg' }, { url: 'javascript:alert(1)' }, { url: 'not a url' }]) {
      expect(parseMalvaBanners({ banners: [banner({ image })] }, 'en-US')[0].image).toBeUndefined();
    }
  });
  it('a category slug that is not a plain slug gives no link', () => {
    expect(parseMalvaBanners({ banners: [banner({ categorySlug: { en: '../admin', de: '../admin' } })] }, 'en-US')[0].categorySlug).toBeUndefined();
  });
});
