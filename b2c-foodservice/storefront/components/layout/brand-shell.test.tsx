import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRANDS } from '@/lib/brands';
import type { Category } from '@/lib/types';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

const cat = (key: string, slug: string, name: string): Category => ({ id: key, key, name, slug, children: [] });
const DRINKS = [cat('mcf-cat-drinks-chic', 'chic', 'Chic'), cat('mcf-cat-drinks-french-kiss', 'french-kiss', 'French Kiss')];
const drinks = BRANDS['malva-drinks'];

afterEach(() => vi.unstubAllGlobals());

describe('Malva Drinks shell', () => {
  it('the header shows the drinks wordmark, its own categories and no store pill', () => {
    stubFetch({ '/api/cart/count': () => ({ count: 0 }) });
    renderShell(<Header categories={DRINKS} brand={drinks} />);
    expect(screen.getAllByText('Malva Drinks').length).toBeGreaterThan(0);
    const nav = screen.getAllByRole('navigation').find((n) => within(n).queryByRole('link', { name: 'Chic' }));
    expect(nav).toBeTruthy();
    expect(within(nav!).getAllByRole('link').map((a) => a.textContent)).toEqual(['Chic', 'French Kiss']);
    expect(screen.queryByText('Pods')).toBeNull();
    expect(screen.queryByRole('button', { name: /store/i })).toBeNull();
  });

  it('the footer has no coffee category links, no collect column and no store picker', () => {
    stubFetch({});
    renderShell(<Footer categories={DRINKS} brand={drinks} />);
    expect(screen.queryByRole('navigation', { name: 'Collect' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose your store' })).toBeNull();
    expect(screen.getByText('Sparkling water, delivered to your door.')).toBeInTheDocument();
  });

  it('the coffee footer keeps the collect column', () => {
    stubFetch({});
    renderShell(<Footer categories={[]} />);
    expect(screen.getByRole('navigation', { name: 'Collect' })).toBeInTheDocument();
  });
});
