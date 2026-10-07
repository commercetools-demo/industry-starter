import de from './de-DE.json';
import en from './en-US.json';

const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('message catalogs', () => {
  it('have identical key sets in en-US and de-DE', () => {
    expect(keys(de).sort()).toEqual(keys(en).sort());
  });
  it('have the required top-level namespaces', () => {
    expect(Object.keys(en).sort()).toEqual(
      ['a11y', 'account', 'auth', 'cart', 'checkout', 'common', 'errors', 'footer', 'home', 'nav', 'pdp', 'plp', 'pricing', 'search', 'static', 'subscription'],
    );
  });
});
