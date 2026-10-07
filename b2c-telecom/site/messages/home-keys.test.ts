import { IntlMessageFormat } from 'intl-messageformat';
import de from './de-DE.json';
import en from './en-US.json';

function leaves(value: unknown, prefix = ''): string[] {
  return typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key)) : [prefix];
}

describe('home messages', () => {
  it('every home key exists in both locales', () => {
    expect(leaves(de.home).sort()).toEqual(leaves(en.home).sort());
    expect(leaves(en.home)).toEqual(expect.arrayContaining(['hero.sub', 'hero.subNoLock', 'categories.from', 'addons.price', 'meta.description']));
  });

  it('the hero sentence compiles and takes its numbers as parameters', () => {
    for (const [locale, messages] of [['en-US', en], ['de-DE', de]] as const) {
      const text = new IntlMessageFormat(messages.home.hero.sub, locale).format({ speed: 'S', price: 'P', months: 24 });
      expect(text).toEqual(expect.stringContaining('24'));
    }
  });

  it('no price, speed or lock length is written into the copy', () => {
    const copy = leaves(en.home)
      .map((key) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], en.home))
      .join(' ');
    expect(copy).not.toMatch(/[0-9]/);
  });
});
