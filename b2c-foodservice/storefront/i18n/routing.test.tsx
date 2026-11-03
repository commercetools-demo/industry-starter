// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const seen: Record<string, unknown>[] = [];
vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => {
    seen.push(props);
    return null;
  },
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ brand: 'malva-drinks' }),
  usePathname: () => '/malva-drinks/en-CA/cart',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));

import { Link } from './routing';

describe('Links do not prefetch', () => {
  it('every page is rendered for the visitor (session, market, stock), so a prefetch is a wasted request: a Link does not prefetch unless asked to (found by Q: 14 `_rsc` requests on the home page)', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart' }, 'Bag'));
    expect(seen[0]?.prefetch).toBe(false);
  });

  it('a Link that asks for a prefetch still gets it', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart', prefetch: true }, 'Bag'));
    expect(seen[0]?.prefetch).toBe(true);
  });

  it('other props reach the router link', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart', className: 'x', 'aria-label': 'Bag' }, 'Bag'));
    expect(seen[0]).toMatchObject({ className: 'x', 'aria-label': 'Bag', prefetch: false });
  });
});

describe('Links carry the brand and the locale', () => {
  it('prefixes the brand of the URL and the locale of the page', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart' }, 'Bag'));
    expect(seen[0]?.href).toBe('/malva-drinks/en-CA/cart');
  });

  it('takes the locale or the brand from a prop (market switch, brand switcher)', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart', locale: 'en-US' }, 'Bag'));
    renderToStaticMarkup(createElement(Link, { href: '/', brand: 'malva-coffee' }, 'Coffee'));
    expect(seen[0]?.href).toBe('/malva-drinks/en-US/cart');
    expect(seen[1]?.href).toBe('/malva-coffee/en-CA');
  });
});
