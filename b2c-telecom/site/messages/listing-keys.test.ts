import { IntlMessageFormat } from 'intl-messageformat';
import { CHIPS_BY_CATEGORY } from '@/lib/config/facets';
import de from './de-DE.json';
import en from './en-US.json';

function leaves(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

const MESSAGES = { 'en-US': en, 'de-DE': de } as const;
const NEW_NAMESPACES = ['plp'] as const;
const NEW_OFFERS_KEYS = ['cta', 'perMonth', 'mostPopular', 'term', 'validity', 'lines', 'customize', 'hint', 'addons', 'equipment', 'included', 'browseAll', 'rent', 'buy', 'needsPlan', 'equipmentKind', 'replace', 'remove', 'addon'] as const;

describe('listing message keys', () => {
  it('every key of the listing exists in both locales', () => {
    const mine = (messages: typeof en): string[] =>
      [...NEW_NAMESPACES.flatMap((namespace) => leaves(messages[namespace], namespace)), ...NEW_OFFERS_KEYS.flatMap((key) => leaves(messages.offers[key], `offers.${key}`))].map(([path]) => path).sort();
    expect(mine(de)).toEqual(mine(en));
    expect(mine(en).length).toBeGreaterThan(80);
  });

  it('every ICU message compiles in both locales and no value is empty', () => {
    for (const locale of ['en-US', 'de-DE'] as const) {
      const messages = MESSAGES[locale];
      const all = [...leaves(messages.plp, 'plp'), ...leaves(messages.offers, 'offers')];
      for (const [path, text] of all) {
        expect(text.length, `${locale} ${path}`).toBeGreaterThan(0);
        expect(() => new IntlMessageFormat(text, locale), `${locale} ${path}`).not.toThrow();
      }
    }
  });

  it('every chip id of every category has a label in both locales', () => {
    const ids = new Set(Object.values(CHIPS_BY_CATEGORY).flat());
    for (const locale of ['en-US', 'de-DE'] as const) {
      const filter = MESSAGES[locale].plp.filter as Record<string, string>;
      for (const id of ids) expect(filter[id], `${locale} chip ${id}`).toBeTruthy();
    }
  });

  it('plural messages render the count in both locales', () => {
    expect(new IntlMessageFormat(en.plp.count.plans, 'en-US').format({ count: 1 })).toBe('1 plan');
    expect(new IntlMessageFormat(en.plp.count.plans, 'en-US').format({ count: 3 })).toBe('3 plans');
    expect(new IntlMessageFormat(de.plp.count.plans, 'de-DE').format({ count: 3 })).toBe('3 Tarife');
    expect(new IntlMessageFormat(de.offers.replace.dependents, 'de-DE').format({ count: 1 })).toBe('Beim Wechsel entfällt 1 Zusatzoption.');
  });
});
