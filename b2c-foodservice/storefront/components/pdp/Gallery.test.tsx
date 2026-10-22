import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { machinePage, podPage, renderPdp, variantView } from '@/test/pdp';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  default: ({ src, alt, priority, fetchPriority }: { src: string; alt: string; priority?: boolean; fetchPriority?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-priority={priority ? 'true' : 'false'} data-fetchpriority={fetchPriority ?? 'auto'} />
  ),
}));

const mainImage = () => within(screen.getByTestId('pdp-main-image')).queryByRole('img') as HTMLImageElement | null;

describe('Gallery', () => {
  it('Variant imagery swaps with the colour', async () => {
    const user = userEvent.setup();
    await renderPdp(machinePage());
    expect(mainImage()?.src).toContain('black-1');
    await user.click(screen.getByRole('radio', { name: 'Red' }));
    expect(mainImage()?.src).toContain('red-1');
    expect(screen.getAllByRole('button', { name: /Show image/ })).toHaveLength(2);
  });

  it('choosing another image then another colour resets the selected thumbnail to the first', async () => {
    const user = userEvent.setup();
    await renderPdp(machinePage());
    await user.click(screen.getByRole('button', { name: 'Show image 2 of 2' }));
    expect(mainImage()?.src).toContain('black-2');
    await user.click(screen.getByRole('radio', { name: 'Red' }));
    expect(mainImage()?.src).toContain('red-1');
    expect(screen.getByRole('button', { name: 'Show image 1 of 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to master images: a variant that shares the product images shows them', async () => {
    await renderPdp(podPage(), { query: { capsulesPerPack: '50' } });
    expect(mainImage()?.src).toContain('pack');
    // one image only: no thumbnail strip
    expect(screen.queryByRole('group', { name: 'Product images' })).toBeNull();
  });

  it('arrow keys move selection', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage());
    const thumbs = screen.getAllByRole('button', { name: /Show image/ });
    thumbs[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(thumbs[1]).toHaveFocus();
    expect(thumbs[1]).toHaveAttribute('aria-pressed', 'true');
    expect(mainImage()?.src).toContain('lifestyle');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(thumbs[2]).toHaveFocus(); // wraps around
    expect(mainImage()?.src).toContain('box');
  });

  it('placeholder when no images', async () => {
    const data = podPage();
    data.product.variants = data.product.variants.map((v) => ({ ...v, images: [] }));
    await renderPdp(data);
    expect(mainImage()).toBeNull();
    expect(screen.getByText('Photo coming soon')).toBeInTheDocument();
  });

  it('first image has priority, thumbnails are lazy', async () => {
    await renderPdp(podPage());
    expect(mainImage()).toHaveAttribute('data-priority', 'true');
    // the hint the browser reads: the picture the page waits for is fetched before the rest (Lighthouse lcp-discovery)
    expect(mainImage()).toHaveAttribute('data-fetchpriority', 'high');
    for (const thumb of screen.getAllByRole('button', { name: /Show image/ })) {
      expect(within(thumb).getByRole('presentation', { hidden: true })).toHaveAttribute('data-priority', 'false');
    }
  });

  it('badge and heart sit on the image; alt text names the product and the view', async () => {
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { images: [{ url: 'https://img.example.com/a.jpg', alt: 'Ember Ristretto' }] });
    await renderPdp(data);
    expect(within(screen.getByTestId('pdp-main-image')).getByText('Bestseller')).toBeInTheDocument();
    expect(within(screen.getByTestId('pdp-main-image')).getByRole('button', { name: /Save Ember Ristretto/ })).toBeInTheDocument();
    expect(mainImage()).toHaveAttribute('alt', 'Ember Ristretto, view 1');
  });

  it('no axe violations', async () => {
    const { container } = await renderPdp(machinePage());
    await expectNoAxeViolations(container);
  });
});
