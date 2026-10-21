import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { accessoryPage, coffeePage, machinePage, podPage, renderPdp, stock, variantView } from '@/test/pdp';
import { stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

beforeEach(() => {
  stubFetch({ '/api/channels': () => ({ stores: [], selectedKey: null }) });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const price = () => screen.getByTestId('pdp-price').textContent ?? '';
const groupNames = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-attr]')).map((g) => g.getAttribute('data-attr'));

describe('buy box header and selectors', () => {
  it('Price follows the variant: pack size changes price and unit price at once', async () => {
    await renderPdp(podPage());
    expect(price()).toBe('$5.90');
    expect(screen.getByTestId('pdp-unit-price')).toHaveTextContent('$0.59 per capsule');
    // synchronous: no await after the click
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '50 box' }));
    });
    expect(price()).toBe('$25.95');
    expect(screen.getByTestId('pdp-unit-price')).toHaveTextContent('$0.52 per capsule');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '100 box' }));
    });
    expect(price()).toBe('$47.20');
  });

  it('shows From the lowest price while a required choice is missing, then the unit price', async () => {
    await renderPdp(coffeePage());
    expect(price()).toBe('From $16.95');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    });
    expect(price()).toBe('$16.95');
    expect(screen.getByTestId('pdp-unit-price')).toHaveTextContent('$6.78 per 100 g');
  });

  it('selectors per shape (pods, coffee, machine, accessory)', async () => {
    const pods = await renderPdp(podPage());
    expect(groupNames(pods.container)).toEqual(['capsulesPerPack']);
    expect(screen.getByRole('button', { name: '10 sleeve' })).toHaveAttribute('aria-pressed', 'true');
    pods.unmount();
    const coffee = await renderPdp(coffeePage());
    expect(groupNames(coffee.container)).toEqual(['sizeGrams', 'grind']);
    expect(screen.getByRole('button', { name: '250 g' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1 kg' })).toHaveAttribute('aria-pressed', 'false');
    // no default for the grind: nothing pressed
    expect(screen.getByRole('button', { name: 'Whole bean' })).toHaveAttribute('aria-pressed', 'false');
    coffee.unmount();
    const machine = await renderPdp(machinePage());
    expect(groupNames(machine.container)).toEqual(['colour', 'bundle']);
    expect(screen.getByRole('radiogroup', { name: /Color/ })).toBeInTheDocument();
    machine.unmount();
    const accessory = await renderPdp(accessoryPage());
    expect(groupNames(accessory.container)).toEqual(['colour']);
  });

  it('colour ring and aria', async () => {
    await renderPdp(machinePage());
    const black = screen.getByRole('radio', { name: 'Black' });
    const red = screen.getByRole('radio', { name: 'Red' });
    expect(black).toHaveAttribute('aria-checked', 'true');
    expect(black.className).toContain('shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--ink)]');
    expect(red).toHaveAttribute('aria-checked', 'false');
    expect(red.className).not.toContain('var(--ink)');
    expect(red.style.background).toContain('--swatch-red');
    fireEvent.click(red);
    expect(red).toHaveAttribute('aria-checked', 'true');
    expect(black).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radiogroup', { name: 'Color - Red' })).toBeInTheDocument();
  });

  it('selection mirrored with replaceState and restored from the URL', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    await renderPdp(coffeePage());
    expect(replace).not.toHaveBeenCalled(); // nothing on first render
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('button', { name: '1 kg' }));
    const last = replace.mock.calls.at(-1)?.[2] as string;
    expect(last).toContain('sizeGrams=1000');
    expect(last).toContain('grind=filter');
    expect(price()).toBe('$57.65');
    // a shared URL reproduces the selection
    document.body.innerHTML = '';
    await renderPdp(coffeePage(), { query: { sizeGrams: '1000', grind: 'filter', junk: 'x' } });
    expect(screen.getByRole('button', { name: '1 kg' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('aria-pressed', 'true');
    // an unknown value is ignored
    document.body.innerHTML = '';
    await renderPdp(coffeePage(), { query: { sizeGrams: '999' } });
    expect(screen.getByRole('button', { name: '250 g' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('choose param highlights the selector', async () => {
    vi.useFakeTimers();
    await renderPdp(coffeePage(), { choose: 'grind' });
    const group = document.querySelector('[data-attr="grind"]') as HTMLElement;
    expect(group).toHaveAttribute('data-highlight', 'true');
    expect(within(group).getByRole('status')).toHaveTextContent('Choose a grind');
    expect(document.querySelector('[data-attr="sizeGrams"]')).not.toHaveAttribute('data-highlight');
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(group).not.toHaveAttribute('data-highlight');
  });

  it('guide modals trap focus and return it', async () => {
    const user = userEvent.setup();
    await renderPdp(coffeePage());
    const opener = screen.getByRole('button', { name: 'Grind guide' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Which grind for which brew' });
    expect(dialog).toHaveAttribute('aria-hidden', 'false');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true); // Tab never leaves the dialog
    expect(within(dialog).getByRole('row', { name: /Espresso/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('the compatibility guide lists the systems and links to the pod categories', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage());
    await user.click(screen.getByRole('button', { name: 'Compatibility guide' }));
    const dialog = screen.getByRole('dialog', { name: 'Which capsules fit which machine' });
    expect(within(dialog).getByText('Original and Vertuo capsules are not interchangeable.')).toBeInTheDocument();
    expect(within(dialog).getByText('Does not use capsules')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Shop Vertuo pods' })).toHaveAttribute('href', '/category/vertuo-pods');
  });

  it('intensity bar text alternative', async () => {
    await renderPdp(podPage());
    const bar = screen.getByRole('img', { name: 'Intensity 12 of 13' });
    expect(bar.children).toHaveLength(13);
    expect(screen.getByText('dark chocolate')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dark' })).toBeInTheDocument();
  });

  it('No price resolves: price on request, no list price, nothing can be added', async () => {
    const data = podPage();
    data.product.variants = data.product.variants.map((v) => ({ ...v, price: null, recurring: [], unit: undefined }));
    delete (data.product.variants[0] as { unit?: unknown }).unit;
    await renderPdp(data);
    expect(price()).toBe('Price on request');
    expect(screen.queryByTestId('pdp-unit-price')).toBeNull();
    const add = screen.getByTestId('add-to-bag');
    expect(add).toBeDisabled();
    expect(add).toHaveTextContent('Price on request');
    expect(screen.queryByRole('radio', { name: /Subscribe/ })).toBeNull();
  });

  it('Incompatible combination: starter capsules is disabled with the reason for a machine that takes none', async () => {
    await renderPdp(machinePage('espresso'));
    const starter = screen.getByRole('button', { name: 'Starter capsules' });
    expect(starter).toHaveAttribute('aria-disabled', 'true');
    expect(starter).toHaveAttribute('title', 'Not offered for this machine');
    fireEvent.click(starter);
    expect(screen.getByRole('button', { name: 'Machine only' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a machine that takes capsules offers the starter capsules bundle', async () => {
    await renderPdp(machinePage('vertuo'));
    expect(screen.getByRole('button', { name: 'Starter capsules' })).not.toHaveAttribute('aria-disabled');
  });

  it('Variant out of stock at store: the option is disabled with the reason when collecting there', async () => {
    const data = machinePage('original');
    data.product.variants = data.product.variants.map((v) =>
      v.sku === 'MAC-B-S' || v.sku === 'MAC-R-S' ? { ...v, stock: stock({ stores: { 'ch-soho': 0 } }) } : v,
    );
    await renderPdp(data, { selectedKey: 'mcf-store-nyc-soho' });
    const starter = screen.getByRole('button', { name: 'Starter capsules' });
    expect(starter).toHaveAttribute('aria-disabled', 'true');
    expect(starter).toHaveAttribute('title', 'Not available for collection at this store');
    // switching to delivery enables it again
    fireEvent.click(screen.getByRole('radio', { name: /Delivery/ }));
    expect(screen.getByRole('button', { name: 'Starter capsules' })).not.toHaveAttribute('aria-disabled');
  });

  it('Variant out of stock online does not disable the option', async () => {
    const data = coffeePage();
    data.product.variants[0] = variantView('COF-250-WB', { sizeGrams: 250, grind: 'whole-bean' }, 1695, { stock: stock({ online: 0 }), attrLabels: { grind: 'Whole bean' } });
    await renderPdp(data);
    expect(screen.getByRole('button', { name: 'Whole bean' })).not.toHaveAttribute('aria-disabled');
  });

  it('rating link goes to the reviews section; no reviews offers the first review', async () => {
    const withRating = await renderPdp(podPage());
    expect(screen.getByRole('link', { name: /4\.5 out of 5, 4 reviews/ })).toHaveAttribute('href', '#reviews');
    withRating.unmount();
    const data = podPage();
    data.product.rating = null;
    await renderPdp(data);
    expect(screen.getAllByText('Be the first to review').length).toBeGreaterThan(0);
  });

  it('no axe violations on a coffee page', async () => {
    const { container } = await renderPdp(coffeePage());
    await expectNoAxeViolations(container);
  });
});
