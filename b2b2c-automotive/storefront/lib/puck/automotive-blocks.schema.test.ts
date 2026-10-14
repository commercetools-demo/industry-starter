// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { AUTOMOTIVE_BLOCKS, DEFAULTS, isSafeUrl, parseBlockProps } from './automotive-blocks.schema';

describe('automotive block schema', () => {
  it('defaults per block', () => {
    for (const name of AUTOMOTIVE_BLOCKS) {
      expect(parseBlockProps(name, {})).toEqual(DEFAULTS[name]);
      expect(parseBlockProps(name, undefined)).toEqual(DEFAULTS[name]);
      expect(parseBlockProps(name, 'junk')).toEqual(DEFAULTS[name]);
    }
    expect(DEFAULTS.AutomotiveHero.showFinder).toBe(true);
    expect(DEFAULTS.PopularProducts.count).toBe(8);
    expect(DEFAULTS.PromoBanner.tone).toBe('brand');
  });

  it('valid props pass through', () => {
    const props = { id: 'x', eyebrow: 'E', headline: 'H', supportingLine: 'S {city}', ctaLabel: 'Go', ctaHref: 'https://example.com/a', imageUrl: '/img.jpg', showFinder: false };
    expect(parseBlockProps('AutomotiveHero', props)).toEqual({ eyebrow: 'E', headline: 'H', supportingLine: 'S {city}', ctaLabel: 'Go', ctaHref: 'https://example.com/a', imageUrl: '/img.jpg', showFinder: false });
  });

  it('count clamps to 4..8', () => {
    const count = (n: unknown) => parseBlockProps('PopularProducts', { count: n }).count;
    expect(count(1)).toBe(4);
    expect(count(100)).toBe(8);
    expect(count(5.4)).toBe(5);
    expect(count(6)).toBe(6);
    expect(count('6')).toBe(8);
    expect(count(Number.NaN)).toBe(8);
    expect(count(undefined)).toBe(8);
  });

  it('invalid props fall back to defaults', () => {
    const props = parseBlockProps('AutomotiveHero', { headline: 42, ctaLabel: '', showFinder: 'yes', eyebrow: 'Kept' });
    expect(props.headline).toBe(DEFAULTS.AutomotiveHero.headline);
    expect(props.ctaLabel).toBe(DEFAULTS.AutomotiveHero.ctaLabel);
    expect(props.showFinder).toBe(true);
    expect(props.eyebrow).toBe('Kept');
    expect(parseBlockProps('BrandStrip', { brands: 'nope' }).brands).toEqual([]);
    expect(parseBlockProps('BrandStrip', { brands: [{ name: 'A' }, { name: '' }, 3, null, { name: 'B', href: '/x' }] }).brands).toEqual([{ name: 'A' }, { name: 'B', href: '/x' }]);
  });

  it('overrides replace the defaults (localized texts)', () => {
    expect(parseBlockProps('CategoryTiles', {}, { title: 'Nach Kategorie einkaufen' }).title).toBe('Nach Kategorie einkaufen');
    expect(parseBlockProps('CategoryTiles', { title: 'Own' }, { title: 'Nach Kategorie' }).title).toBe('Own');
  });

  it('unknown tone becomes brand', () => {
    expect(parseBlockProps('PromoBanner', { title: 'T', text: 'x', tone: 'neon' }).tone).toBe('brand');
    expect(parseBlockProps('PromoBanner', { tone: 'accent' }).tone).toBe('accent');
    expect(parseBlockProps('PromoBanner', { tone: 'neutral' }).tone).toBe('neutral');
  });

  it('urls must be http(s) or relative', () => {
    expect(isSafeUrl('/parts')).toBe(true);
    expect(isSafeUrl('https://example.com/x?y=1')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    for (const bad of ['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html,hi', '//evil.example', 'ftp://x.example', 'parts', '', '/a\\b', 'vbscript:x']) {
      expect(isSafeUrl(bad)).toBe(false);
    }
    const promo = parseBlockProps('PromoBanner', { title: 'T', text: 'x', ctaLabel: 'Go', ctaHref: 'javascript:alert(1)' });
    expect(promo.ctaHref).toBeUndefined();
    expect(parseBlockProps('AutomotiveHero', { ctaHref: 'javascript:alert(1)' }).ctaHref).toBe('/parts');
    expect(parseBlockProps('AutomotiveHero', { imageUrl: 'javascript:alert(1)' }).imageUrl).toBeUndefined();
    expect(parseBlockProps('BrandStrip', { brands: [{ name: 'A', logoUrl: 'javascript:1', href: 'data:x' }] }).brands).toEqual([{ name: 'A' }]);
  });

  it('is framework free', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('lib/puck/automotive-blocks.schema.ts', 'utf8');
    const imports = source.split('\n').filter((l) => l.startsWith('import '));
    expect(imports).toEqual(["import { z } from 'zod';"]);
  });
});
