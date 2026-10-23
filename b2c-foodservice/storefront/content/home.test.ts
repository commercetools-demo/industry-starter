import { describe, expect, it } from 'vitest';
import { HOME_CONTENT, headlineLines, pick, type PerLocale } from '@/content/home';
import { COUNTRY_CONFIG } from '@/lib/utils';

const LOCALES = Object.keys(COUNTRY_CONFIG);

function perLocaleFields(): [string, PerLocale][] {
  const out: [string, PerLocale][] = [];
  for (const [section, fields] of Object.entries({ hero: HOME_CONTENT.hero, editorial: HOME_CONTENT.editorial })) {
    for (const [name, value] of Object.entries(fields)) {
      if (value && typeof value === 'object') out.push([`${section}.${name}`, value as PerLocale]);
    }
  }
  return out;
}

describe('home content module', () => {
  it('content has both locales', () => {
    for (const [name, field] of perLocaleFields()) {
      for (const locale of LOCALES) expect(field[locale as keyof PerLocale], `${name} ${locale}`).toBeTruthy();
    }
  });

  it('image urls are clean', () => {
    for (const url of [HOME_CONTENT.hero.imageUrl, HOME_CONTENT.editorial.imageUrl]) {
      if (url) expect(url).not.toMatch(/[?#]/);
    }
  });

  it('Editorial content: copy image and link come from the content module', () => {
    expect(pick(HOME_CONTENT.editorial.headline, 'en-US')).toBe('Sourced with care.\nRoasted for flavour.');
    expect(HOME_CONTENT.editorial.href.startsWith('/')).toBe(true);
    expect(headlineLines(pick(HOME_CONTENT.hero.headline, 'en-CA'))).toEqual(['Great coffee,', 'your way.']);
  });

  it('the Canadian hero subline does not promise collection', () => {
    expect(pick(HOME_CONTENT.hero.subline, 'en-CA').toLowerCase()).not.toContain('collect');
  });

  it('tiles are configured by category key, not by slug', () => {
    for (const key of HOME_CONTENT.tiles.categoryKeys) expect(key).toMatch(/^mcf-cat-/);
  });
});
