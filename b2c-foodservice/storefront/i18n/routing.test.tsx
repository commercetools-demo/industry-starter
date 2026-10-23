// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const seen: Record<string, unknown>[] = [];
vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: (props: Record<string, unknown>) => {
      seen.push(props);
      return null;
    },
    redirect: vi.fn(),
    permanentRedirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    getPathname: vi.fn(),
  }),
}));

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

  it('other props, the ref and the locale reach the router link', () => {
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: '/cart', locale: 'en-CA', className: 'x', 'aria-label': 'Bag' }, 'Bag'));
    expect(seen[0]).toMatchObject({ href: '/cart', locale: 'en-CA', className: 'x', 'aria-label': 'Bag', prefetch: false });
  });
});
