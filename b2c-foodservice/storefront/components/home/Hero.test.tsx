import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIGURES, product } from '@/components/home/home-fixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

const open = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/hooks/useCollectionStore', () => ({ useCollectionStore: () => ({ open }) }));

import Hero from '@/components/home/Hero';

beforeEach(() => open.mockReset());

describe('Hero', () => {
  it('Hero product: glass card links to the product page and shows its price', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={product()} collection />);
    const card = screen.getByTestId('hero-featured-card');
    expect(card).toHaveAttribute('href', '/p/ember-ristretto/MCF-POD-EMBER-10');
    expect(card).toHaveTextContent('Ember Ristretto');
    expect(card).toHaveTextContent('$123.45');
  });

  it('no featured product hides the card', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={null} collection />);
    expect(screen.queryByTestId('hero-featured-card')).toBeNull();
  });

  it('a featured product without a price hides the card', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={product({ price: null })} collection />);
    expect(screen.queryByTestId('hero-featured-card')).toBeNull();
  });

  it('the eyebrow uses accent-press: accent text on the warm glow behind the hero is 4.4 to 4.5:1, under the AA minimum for 11 px text', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={product()} collection />);
    const eyebrow = document.querySelector('.eyebrow') as HTMLElement;
    expect(eyebrow.className).toContain('!text-accent-press');
    expect(eyebrow.className).not.toMatch(/!text-accent(?!-)/);
  });

  it('hero has exactly one h1', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={product()} collection />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Great coffee,your way.');
  });

  it('promise figures come from the figures function not constants', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={null} collection />);
    const list = screen.getByRole('list', { name: 'Our promises' });
    expect(within(list).getByText('Free shipping over $88.00')).toBeInTheDocument();
    expect(within(list).getByText('Free collection, ready in 17 minutes')).toBeInTheDocument();
    expect(within(list).getByText('21-day returns')).toBeInTheDocument();
  });

  it('a missing figure drops only its promise', () => {
    renderShell(<Hero locale="en-US" figures={{ ...FIGURES, freeShippingThreshold: null, returnDays: 0 }} featured={null} collection />);
    const list = screen.getByRole('list', { name: 'Our promises' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('Canada market hides store button and collect promise', () => {
    renderShell(
      <Hero locale="en-CA" figures={{ ...FIGURES, freeShippingThreshold: { centAmount: 9900, currencyCode: 'CAD' } }} featured={null} collection={false} />,
      { locale: 'en-CA' },
    );
    expect(screen.queryByRole('button', { name: /find your store/i })).toBeNull();
    expect(screen.queryByText(/collection/i)).toBeNull();
    expect(screen.getByText(/Free shipping over/)).toBeInTheDocument();
  });

  it('Find your store opens the picker', async () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={null} collection />);
    await userEvent.click(screen.getByRole('button', { name: 'Find your store' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('Shop the edit links to the bestsellers listing', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={null} collection />);
    expect(screen.getByRole('link', { name: 'Shop the edit' })).toHaveAttribute('href', '/shop?f_collection=bestseller');
  });

  it('Narrow screen: image column has display none under 900 and text fills the width', () => {
    renderShell(<Hero locale="en-US" figures={FIGURES} featured={product()} collection />);
    // Tailwind: max-stack is below 900px (tokens.css). The grid has one column until stack: (900px) adds the second.
    expect(screen.getByTestId('hero-media').className).toContain('max-stack:hidden');
    const grid = screen.getByTestId('hero-media').parentElement as HTMLElement;
    expect(grid.className).toContain('stack:grid-cols-');
    expect(grid.className).not.toMatch(/(^| )grid-cols-/);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell(<Hero locale="en-US" figures={FIGURES} featured={product()} collection />);
    await expectNoAxeViolations(container);
  });
});
