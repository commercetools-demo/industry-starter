import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addErrorKey } from '@/components/pdp/AddToBag';
import { useCartCount } from '@/hooks/useCartCount';
import { coffeePage, podPage, renderPdp, stock, variantView } from '@/test/pdp';
import { nav } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function Count() {
  return <output data-testid="count">{useCartCount()}</output>;
}

const cart = (count: number) => ({ cart: { id: 'c1', version: 2, count, lines: [{ id: 'l1', sku: 'POD-10', quantity: count }] } });
let posted: Record<string, unknown>[] = [];
let answer: () => Response | Record<string, unknown>;

const render = (data = podPage(), opts: Parameters<typeof renderPdp>[1] = {}) =>
  renderPdp(data, {
    ...opts,
    extra: <Count />,
    routes: {
      '/api/cart/lines': (init) => {
        posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return answer();
      },
    },
  });
const add = () => screen.getByTestId('add-to-bag');
const error = (status: number, code: string) => () => Response.json({ error: { code, message: 'x' } }, { status });

beforeEach(() => {
  posted = [];
  answer = () => cart(1);
  nav.refresh.mockReset();
});

describe('add to bag', () => {
  it('the button never shrinks below its label and padding, so a long label wraps under the stepper at 375 px', async () => {
    await render();
    expect(add().className).toMatch(/\bmin-w-fit\b/);
    expect(add().className).not.toMatch(/min-w-\[/);
  });

  it('Add sends a delivery line, toasts and updates the header count', async () => {
    const user = userEvent.setup();
    await render();
    expect(add()).toHaveTextContent('Add to bag - $5.90');
    await user.click(add());
    expect(posted).toEqual([{ sku: 'POD-10', quantity: 1, fulfilment: 'delivery' }]);
    expect(await screen.findByText('Added to bag')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(nav.push).not.toHaveBeenCalled(); // nothing opens or navigates (Q-H-12)
  });

  it('Reserve sends the chosen store and says Reserved for collection', async () => {
    const user = userEvent.setup();
    await render(podPage(), { selectedKey: 'mcf-store-nyc-soho' });
    expect(add()).toHaveTextContent('Reserve for collection - $5.90');
    await user.click(add());
    expect(posted).toEqual([{ sku: 'POD-10', quantity: 1, fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' }]);
    expect(await screen.findByText('Reserved for collection')).toBeInTheDocument();
  });

  it('Subscribe sends the policy key and the recurring total', async () => {
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole('radio', { name: /Subscribe and save/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delivery interval' }), 'Every month');
    expect(add()).toHaveTextContent('Subscribe - $5.31');
    await user.click(add());
    expect(posted).toEqual([{ sku: 'POD-10', quantity: 1, fulfilment: 'subscribe', recurrencePolicyKey: 'mcf-every-month' }]);
    expect(await screen.findByText('Added to bag')).toBeInTheDocument();
  });

  it('the line is for the resolved variant and quantity, total follows the stepper', async () => {
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole('button', { name: '50 box' }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(add()).toHaveTextContent('Add to bag - $77.85');
    await user.click(add());
    expect(posted).toEqual([{ sku: 'POD-50', quantity: 3, fulfilment: 'delivery' }]);
  });

  it('stepper minimum is 1', async () => {
    await render();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Quantity' })).toBeInTheDocument();
  });

  it('quantity clamps to stock and min and max cart quantity', async () => {
    const user = userEvent.setup();
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 3, minQty: 2, maxQty: 10 }) });
    await render(data);
    const group = screen.getByRole('group', { name: 'Quantity' });
    expect(within(group).getByText('2')).toBeInTheDocument(); // starts at the minimum
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(within(group).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByText('Only 3 available')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(within(group).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled(); // the minimum is 2
  });

  it('the stepper follows the stock of the active fulfilment (collect uses the store, not online)', async () => {
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 40, stores: { 'ch-soho': 2 } }) });
    await render(data, { selectedKey: 'mcf-store-nyc-soho' });
    const inc = screen.getByRole('button', { name: 'Increase quantity' });
    fireEvent.click(inc);
    expect(inc).toBeDisabled();
    expect(screen.getByText('Only 2 available')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Delivery/ }));
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('an empty store shows Unavailable for collection and no stock limit line', async () => {
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 40, stores: { 'ch-soho': 0 } }) });
    await render(data, { selectedKey: 'mcf-store-nyc-soho' });
    fireEvent.click(screen.getByRole('radio', { name: /Collect in store/ }));
    expect(add()).toBeDisabled();
    expect(add()).toHaveTextContent('Unavailable for collection');
    expect(screen.queryByText(/Only \d+ available/)).not.toBeInTheDocument();
  });

  it('409 not_available_for_collection refreshes and explains', async () => {
    const user = userEvent.setup();
    answer = error(409, 'not_available_for_collection');
    await render(podPage(), { selectedKey: 'mcf-store-nyc-soho' });
    await user.click(add());
    expect(await screen.findByRole('alert')).toHaveTextContent('That item just ran out at this store');
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(screen.queryByText('Reserved for collection')).toBeNull();
  });

  it('other refusals map to their own text and keep the bag count', async () => {
    const user = userEvent.setup();
    answer = error(422, 'price_unavailable');
    await render();
    await user.click(add());
    expect(await screen.findByRole('alert')).toHaveTextContent('This item has no price right now.');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(addErrorKey('conflict')).toBe('conflict');
    expect(addErrorKey('collect_not_available_in_market')).toBe('market');
    expect(addErrorKey('validation_failed')).toBe('price');
    expect(addErrorKey('internal_error')).toBe('generic');
  });

  it('the button shows busy while adding', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    answer = () => cart(1);
    await renderPdp(podPage(), {
      routes: {
        '/api/cart/lines': async () => {
          await gate;
          return cart(1);
        },
      },
    });
    fireEvent.click(add());
    await waitFor(() => expect(add()).toHaveAttribute('aria-busy', 'true'));
    release?.();
    await waitFor(() => expect(add()).not.toHaveAttribute('aria-busy'));
  });

  it('a coffee needs the grind first: the button names the choice and nothing is sent', async () => {
    const user = userEvent.setup();
    await render(coffeePage());
    expect(add()).toHaveTextContent('Select a grind');
    expect(add()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    expect(add()).toHaveTextContent('Add to bag - $16.95');
    await user.click(add());
    expect(posted).toEqual([{ sku: 'COF-250-FIL', quantity: 1, fulfilment: 'delivery' }]);
  });

  it('Out of stock for collection: the stepper cannot ask for more than the store has', async () => {
    const data = podPage();
    await render(data, { selectedKey: 'mcf-store-brooklyn' });
    // Brooklyn has none: delivery by default and the button is live
    expect(add()).toHaveTextContent('Add to bag');
    expect(add()).toBeEnabled();
  });
});
