import de from './de-DE.json';
import en from './en-US.json';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return [prefix];
  return entries.flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}/${key}` : key)).sort();
}

describe('messages parity', () => {
  it('en-US and de-DE have the same deep key set', () => {
    expect(keyPaths(de)).toEqual(keyPaths(en));
  });
  it('has the exact top-level namespaces', () => {
    const expected = ['a11y', 'account', 'auth', 'bundle', 'checkout', 'common', 'content', 'errors', 'footer', 'home', 'nav', 'offers', 'plp', 'pricing', 'region', 'search', 'shell'];
    expect(Object.keys(en).sort()).toEqual(expected);
    expect(Object.keys(de).sort()).toEqual(expected);
  });
  it('seeds the region keys in both locales', () => {
    for (const messages of [en, de]) {
      expect(Object.keys(messages.region).sort()).toEqual(['cartEmptied', 'change', 'error', 'label', 'option', 'switched']);
      expect(Object.keys(messages.region.option).sort()).toEqual(['de-DE', 'en-US']);
    }
  });
});
