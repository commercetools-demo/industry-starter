// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { CHANNEL_IDS, linkInBioLink, parseChannelParam, parseSalesChannel, shareLink } from './share-links';
import { DEFAULT_THEME_CACHE_SECONDS, storefrontAddress, storefrontHost, storefrontOrigin, themeCacheSeconds } from './storefront-origin';

describe('share links', () => {
  it('shareLink for instagram equals origin/locale/store?ch=instagram', () => {
    expect(shareLink('https://shop.example.test', 'de-DE', 'mau-reseller-north', 'instagram')).toBe('https://shop.example.test/de-DE/mau-reseller-north?ch=instagram');
    expect(linkInBioLink('https://shop.example.test', 'en-US', 'mau-reseller-north', 'tiktok')).toBe('https://shop.example.test/en-US/mau-reseller-north/links?ch=tiktok');
  });

  it('parseChannelParam rejects unknown values (in-store has no share link)', () => {
    for (const id of CHANNEL_IDS) expect(parseChannelParam(id)).toBe(id);
    for (const bad of ['in-store', 'INSTAGRAM', 'x', '', null, undefined, 3, ['web']]) expect(parseChannelParam(bad)).toBeNull();
    expect(parseSalesChannel('in-store')).toBe('in-store');
    expect(parseSalesChannel('sms')).toBeNull();
  });

  it('QR data URL has no script', async () => {
    const svg = await QRCode.toString(shareLink('https://shop.example.test', 'de-DE', 'mau-reseller-north', 'whatsapp'), { type: 'svg', margin: 1 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.toLowerCase()).not.toContain('<script');
    expect(svg).not.toMatch(/\son[a-z]+=/i);
  });
});

describe('storefront origin', () => {
  it('trims the slash, defaults in development, is empty in production when unset', () => {
    expect(storefrontOrigin({ STOREFRONT_ORIGIN: 'https://shop.example.test/' })).toBe('https://shop.example.test');
    expect(storefrontOrigin({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(storefrontOrigin({ NODE_ENV: 'production' })).toBe('');
  });
  it('theme cache seconds: default 60, valid override, garbage ignored', () => {
    expect(themeCacheSeconds({})).toBe(DEFAULT_THEME_CACHE_SECONDS);
    expect(themeCacheSeconds({ STOREFRONT_THEME_CACHE_SECONDS: '120' })).toBe(120);
    for (const bad of ['0', '-1', 'abc', '1.5', '99999']) expect(themeCacheSeconds({ STOREFRONT_THEME_CACHE_SECONDS: bad })).toBe(60);
  });
  it('address and host', () => {
    expect(storefrontAddress('https://shop.example.test', 'mau-reseller-north')).toBe('https://shop.example.test/de-DE/mau-reseller-north');
    expect(storefrontHost('https://shop.example.test')).toBe('shop.example.test');
    expect(storefrontHost('not a url')).toBe('not a url');
  });
});
