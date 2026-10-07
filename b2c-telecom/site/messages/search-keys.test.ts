import { IntlMessageFormat } from 'intl-messageformat';
import de from './de-DE.json';
import en from './en-US.json';

function leaves(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

describe('search message keys', () => {
  it('every search key exists in both locales', () => {
    const keys = (messages: typeof en): string[] => leaves(messages.search, 'search').map(([path]) => path).sort();
    expect(keys(de)).toEqual(keys(en));
    expect(keys(en).length).toBeGreaterThan(30);
  });

  it('every ICU message compiles in both locales and no value is empty', () => {
    for (const [locale, messages] of [['en-US', en], ['de-DE', de]] as const) {
      for (const [path, text] of leaves(messages.search, 'search')) {
        expect(text.length, `${locale} ${path}`).toBeGreaterThan(0);
        expect(() => new IntlMessageFormat(text, locale), `${locale} ${path}`).not.toThrow();
      }
    }
  });

  it('the result count is pluralised in both locales', () => {
    expect(new IntlMessageFormat(en.search.found, 'en-US').format({ count: 1, query: 'x' })).toBe('1 result for “x”');
    expect(new IntlMessageFormat(de.search.found, 'de-DE').format({ count: 2, query: 'x' })).toBe('2 Ergebnisse für „x“');
  });
});
