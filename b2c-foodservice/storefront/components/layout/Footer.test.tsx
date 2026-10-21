import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import Footer from '@/components/layout/Footer';

const cat = (key: string, slug: string): Category => ({ id: key, key, name: slug, slug, children: [] });
const TREE = [cat('mcf-cat-pods', 'pods'), cat('mcf-cat-gifts', 'gifts')];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Footer', () => {
  it('renders four columns and bottom links', () => {
    stubFetch({});
    renderShell(<Footer categories={TREE} />);
    for (const name of ['Shop', 'Collect', 'Help', 'Company']) {
      expect(screen.getByRole('navigation', { name })).toBeInTheDocument();
    }
    const legal = screen.getByRole('contentinfo');
    for (const name of ['Privacy', 'Terms', 'Accessibility']) {
      expect(within(legal).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Choose your store' })).toBeInTheDocument();
  });

  it('shop links resolve through the category tree and fall back to home', () => {
    stubFetch({});
    renderShell(<Footer categories={TREE} />);
    const shop = within(screen.getByRole('navigation', { name: 'Shop' }));
    expect(shop.getByRole('link', { name: 'Pods' })).toHaveAttribute('href', '/category/pods');
    expect(shop.getByRole('link', { name: 'Coffee' })).toHaveAttribute('href', '/');
  });

  it('links to unbuilt pages go to the home page, never to #', () => {
    stubFetch({});
    renderShell(<Footer categories={TREE} />);
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(href).not.toMatch(/#/);
      expect(href.length).toBeGreaterThan(0);
    }
    // The account pages are built by workstream L, so "Your orders" is a real link now.
    expect(screen.getByRole('link', { name: 'Your orders' })).toHaveAttribute('href', '/account/orders');
  });

  it('Canada has no Collect column', () => {
    stubFetch({});
    renderShell(<Footer categories={TREE} />, { locale: 'en-CA' });
    expect(screen.queryByRole('navigation', { name: 'Collect' })).toBeNull();
    expect(screen.queryByText(/collect/i)).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Shop' })).toBeInTheDocument();
  });

  it('copyright year', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-04-02T12:00:00Z'));
    stubFetch({});
    renderShell(<Footer categories={TREE} />);
    expect(screen.getByText('© 2031 Malva Coffee')).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    stubFetch({});
    const { container } = renderShell(<Footer categories={TREE} />);
    await expectNoAxeViolations(container);
  });
});
