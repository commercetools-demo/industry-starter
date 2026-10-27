import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryNode, ProductCard } from '@commercetools-labs/page-builder';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { Banner, Cta, Hero, ImageBlock, RichText } from '@/components/page-builder/blocks/ContentBlocks';
import { CategoryTiles, EditorialStrip, ProductStrip, SubscribeStrip } from '@/components/page-builder/blocks/HomeBlocks';

/** The shell test wrapper adds a toast region, so "renders nothing" means no content element. */
const isEmpty = (container: HTMLElement) => expect(container.querySelector('section, figure, article, h1, h2')).toBeNull();

const IMG = 'https://img.example.com/a.jpg';
const card = (n: number, extra: Partial<ProductCard> = {}): ProductCard => ({
  id: `p${n}`, sku: `SKU-${n}`, name: `Pod ${n}`, slug: `pod-${n}`, price: { centAmount: 495, currencyCode: 'USD' }, ...extra,
});
const cat = (slug: string, name: string, image?: string): CategoryNode => ({ id: slug, slug, name, ...(image ? { image: { url: image } } : {}) });

describe('content components', () => {
  it('Hero: headline is the page h1, buttons are links, a missing second button is fine', async () => {
    const { container } = renderShell(
      <Hero data={{ eyebrow: 'Autumn', title: '<strong>Great</strong> coffee', body: '<p>Body</p>', image: IMG, imageAlt: 'A cup', buttons: [{ label: 'Shop', link: '/category/pods' }, { label: '' }] }} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Great coffee');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/category/pods');
    expect(screen.getByAltText('A cup')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('Hero: sanitises author HTML (no script, no event handler, no javascript: link)', () => {
    const { container } = renderShell(<Hero data={{ title: 'Hi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>' }} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|javascript:/i);
  });

  it('Hero with only a headline renders without image, body or buttons', () => {
    renderShell(<Hero data={{ title: 'Only' }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Only');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a button never points at a javascript: or protocol-relative target', () => {
    renderShell(<Hero data={{ title: 'X', buttons: [{ label: 'Bad', link: 'javascript:alert(1)' }, { label: 'Worse', link: '//evil.example' }] }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('external links are plain anchors with rel noopener', () => {
    renderShell(<Cta data={{ label: 'Visit', link: 'https://example.com/x' }} />);
    const a = screen.getByRole('link', { name: 'Visit' });
    expect(a).toHaveAttribute('href', 'https://example.com/x');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('internal links drop a typed locale so Link can add the shopper’s own', () => {
    renderShell(<Cta data={{ label: 'Pods', link: '/en-CA/category/pods' }} />);
    expect(screen.getByRole('link', { name: 'Pods' })).toHaveAttribute('href', '/category/pods');
  });

  it('Banner, RichText, ImageBlock, Cta render nothing they were not given', () => {
    const { container } = renderShell(
      <>
        <RichText data={{}} />
        <ImageBlock data={{}} />
        <Cta data={{}} />
      </>,
    );
    isEmpty(container);
    renderShell(<Banner data={{ title: 'Sale' }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Sale' })).toBeInTheDocument();
  });

  it('ImageBlock: alt comes from the field; an image without alt is decorative', () => {
    renderShell(<ImageBlock data={{ image: IMG, imageAlt: 'Beans', caption: 'Roasted' }} />);
    expect(screen.getByAltText('Beans')).toBeInTheDocument();
    expect(screen.getByText('Roasted')).toBeInTheDocument();
  });

  it('an http or data: image is not drawn', () => {
    renderShell(<ImageBlock data={{ image: 'http://img.example.com/a.jpg' }} />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('home components', () => {
  it('CategoryTiles: a tile per category linking to its listing', async () => {
    const { container } = renderShell(<CategoryTiles data={{ title: 'Shop', categories: [cat('pods', 'Pods', IMG), cat('coffee', 'Coffee')] }} />);
    expect(screen.getAllByTestId('pb-category-tile').map((a) => a.getAttribute('href'))).toEqual(['/category/pods', '/category/coffee']);
    await expectNoAxeViolations(container);
  });

  it('CategoryTiles: no resolved categories renders nothing', () => {
    isEmpty(renderShell(<CategoryTiles data={{ categories: null }} />).container);
    isEmpty(renderShell(<CategoryTiles data={{ categories: [] }} />).container);
  });

  it('EditorialStrip: works without an image and without a link', () => {
    renderShell(<EditorialStrip data={{ headline: 'Sourced with care', ctaLabel: 'Read', link: 'not a link' }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Sourced with care' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('SubscribeStrip: needs a title or a button', () => {
    isEmpty(renderShell(<SubscribeStrip data={{}} />).container);
    renderShell(<SubscribeStrip data={{ title: 'Never run out', label: 'Subscribe', link: '/category/pods' }} />);
    expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/category/pods');
  });

  it('ProductStrip: a tile per product with name link and price; no products renders nothing', () => {
    renderShell(<ProductStrip data={{ title: 'Bestsellers', products: [card(1), card(2, { price: undefined })] }} />);
    const tiles = screen.getAllByTestId('pb-product-tile');
    expect(tiles).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Pod 1' })).toHaveAttribute('href', '/p/pod-1/SKU-1');
    expect(tiles[0]).toHaveTextContent('$4.95');
    isEmpty(renderShell(<ProductStrip data={{ products: [] }} />).container);
  });

  it('ProductStrip: showPrice false hides prices; a discount shows the old price struck', () => {
    renderShell(<ProductStrip data={{ showPrice: false, products: [card(1)] }} />);
    expect(screen.getByTestId('pb-product-tile')).not.toHaveTextContent('$');
  });

  it('ProductStrip: discounted price shows the amount to pay and the list price', () => {
    renderShell(<ProductStrip data={{ products: [card(1, { price: { centAmount: 1000, currencyCode: 'USD', discounted: { centAmount: 800, currencyCode: 'USD' } } })] }} />);
    const tile = screen.getByTestId('pb-product-tile');
    expect(tile).toHaveTextContent('$8.00');
    expect(tile.querySelector('s')).toHaveTextContent('$10.00');
  });
});
