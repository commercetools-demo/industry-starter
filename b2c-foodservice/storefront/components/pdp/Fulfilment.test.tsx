import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { formatInterval } from '@/lib/product/interval';
import { collectionReadiness } from '@/lib/product/readiness';
import { machinePage, podPage, renderPdp, stock, STORE_BK, STORE_SOHO, usd, variantView } from '@/test/pdp';
import { nav } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function Probe() {
  const { isOpen, select } = useCollectionStore();
  return (
    <>
      <output data-testid="picker">{String(isOpen)}</output>
      <button type="button" onClick={() => void select('mcf-store-brooklyn')}>pick-brooklyn</button>
    </>
  );
}

beforeEach(() => {
  nav.refresh.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const radio = (name: RegExp) => screen.queryByRole('radio', { name });
const addButton = () => screen.getByTestId('add-to-bag');

describe('fulfilment cards', () => {
  it('title and saving badge wrap inside a narrow card instead of overflowing it', async () => {
    await renderPdp(podPage());
    const row = screen.getByText('Save 10%').parentElement as HTMLElement;
    expect(row.className).toContain('flex-wrap');
  });

  it('Subscribe appears only for subscribable non-machine variants with a recurring price', async () => {
    const pods = await renderPdp(podPage());
    expect(radio(/Subscribe and save/)).toBeInTheDocument();
    expect(screen.getByText('Save 10%')).toBeInTheDocument();
    pods.unmount();

    const notSubscribable = podPage();
    notSubscribable.product.subscribable = false;
    const a = await renderPdp(notSubscribable);
    expect(radio(/Subscribe and save/)).toBeNull();
    a.unmount();

    const noRecurring = podPage();
    noRecurring.product.variants[1] = variantView('POD-50', { capsulesPerPack: 50 }, 2595);
    const b = await renderPdp(noRecurring, { query: { capsulesPerPack: '50' } });
    expect(radio(/Subscribe and save/)).toBeNull();
    b.unmount();

    const noPolicies = podPage({ policies: [] });
    await renderPdp(noPolicies);
    expect(radio(/Subscribe and save/)).toBeNull();
  });

  it('machines never offer subscribe', async () => {
    const data = machinePage();
    data.product.subscribable = true; // even if the data said so
    data.policies = [{ id: 'rp-1m', key: 'k', name: 'n', schedule: { unit: 'Months', value: 1 } }];
    data.product.variants = data.product.variants.map((v) => ({ ...v, recurring: [{ policyId: 'rp-1m', value: usd(100) }] }));
    await renderPdp(data);
    expect(radio(/Subscribe and save/)).toBeNull();
  });

  it('Canada market renders no Collect card, no collect block and no store control', async () => {
    const ca = podPage({ collection: false, country: 'CA', currency: 'CAD' });
    await renderPdp(ca, { locale: 'en-CA' });
    expect(radio(/Collect in store/)).toBeNull();
    expect(radio(/Delivery/)).toBeInTheDocument();
    expect(radio(/Subscribe and save/)).toBeInTheDocument();
    expect(screen.queryByTestId('collect-block')).toBeNull();
    expect(screen.queryByRole('button', { name: /Choose a store/ })).toBeNull();
    expect(screen.getByTestId('ship-block')).toBeInTheDocument();
  });

  it('default fulfilment: collect when a store is chosen and the variant is in stock there, else delivery', async () => {
    const a = await renderPdp(podPage(), { selectedKey: 'mcf-store-nyc-soho' });
    expect(radio(/Collect in store/)).toBeChecked();
    a.unmount();
    const b = await renderPdp(podPage(), { selectedKey: 'mcf-store-brooklyn' }); // 0 in stock there
    expect(radio(/Delivery/)).toBeChecked();
    b.unmount();
    await renderPdp(podPage());
    expect(radio(/Delivery/)).toBeChecked();
  });

  it('the cards are a radiogroup answering the arrow keys', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage(), { selectedKey: 'mcf-store-nyc-soho' });
    expect(screen.getByRole('radiogroup', { name: 'How would you like it?' })).toBeInTheDocument();
    radio(/Collect in store/)?.focus();
    await user.keyboard('{ArrowRight}');
    expect(radio(/Delivery/)).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(radio(/Subscribe and save/)).toBeChecked();
  });

  it('delivery card reads the live free-shipping threshold, never a constant', async () => {
    const a = await renderPdp(podPage({ freeShippingThreshold: usd(9900) }));
    expect(radio(/Free over \$99\.00, 2 to 4 days/)).toBeInTheDocument();
    a.unmount();
    await renderPdp(podPage({ freeShippingThreshold: null }));
    expect(radio(/Delivered in 2 to 4 days/)).toBeInTheDocument();
  });
});

describe('collect block', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T16:00:00Z')); // Wednesday noon in New York
  });

  it('collect block shows status address ready line and Change', async () => {
    await renderPdp(podPage(), { selectedKey: 'mcf-store-nyc-soho', extra: <Probe /> });
    const block = screen.getByTestId('collect-block');
    expect(block).toHaveAttribute('data-state', 'in');
    expect(within(block).getByText('In stock at Malva SoHo')).toBeInTheDocument();
    expect(within(block).getByText('1 Prince St, New York')).toBeInTheDocument();
    expect(within(block).getByText('Ready today, in about 15 minutes')).toBeInTheDocument();
    expect(addButton()).toHaveTextContent('Reserve for collection - $5.90');
    fireEvent.click(within(block).getByRole('button', { name: 'Change' }));
    expect(screen.getByTestId('picker')).toHaveTextContent('true');
  });

  it('low stock reads Low stock at the store', async () => {
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ stores: { 'ch-soho': 3 } }) });
    await renderPdp(data, { selectedKey: 'mcf-store-nyc-soho' });
    expect(screen.getByTestId('collect-block')).toHaveAttribute('data-state', 'low');
    expect(screen.getByText('Low stock at Malva SoHo')).toBeInTheDocument();
  });

  it('Collect at an empty store shows Unavailable and ship stays available', async () => {
    const user = userEvent.setup();
    const data = podPage();
    await renderPdp(data, { selectedKey: 'mcf-store-brooklyn' });
    // Brooklyn has 0: default is delivery, so choose Collect by hand
    await user.click(radio(/Collect in store/) as HTMLElement);
    const block = screen.getByTestId('collect-block');
    expect(block).toHaveAttribute('data-state', 'out');
    expect(within(block).getByText('Unavailable at Malva Brooklyn')).toBeInTheDocument();
    expect(within(block).queryByText(/Ready today/)).toBeNull();
    expect(addButton()).toHaveTextContent('Unavailable for collection');
    expect(addButton()).toBeDisabled();
    await user.click(radio(/Delivery/) as HTMLElement);
    expect(addButton()).toHaveTextContent('Add to bag - $5.90');
    expect(addButton()).toBeEnabled();
  });

  it('no store asks to choose a store and the button opens the picker', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage(), { extra: <Probe /> });
    await user.click(radio(/Collect in store/) as HTMLElement);
    const block = screen.getByTestId('collect-block');
    expect(within(block).getByText('Choose a store to see availability')).toBeInTheDocument();
    expect(addButton()).toHaveTextContent('Choose a store');
    expect(addButton()).toBeEnabled();
    await user.click(addButton());
    expect(screen.getByTestId('picker')).toHaveTextContent('true');
  });

  it('a closed store promises nothing today and names the next opening', () => {
    const closedSundays = { ...STORE_SOHO.hours, sun: null, mon: { open: '08:00', close: '18:00' } };
    const store = { hours: closedSundays, timeZone: 'America/New_York', collectionMinutes: 15 };
    // Sunday 20 Dec 2026, noon in New York: closed, next opening Monday 08:00, ready 08:15
    expect(collectionReadiness(store, new Date('2026-12-20T17:00:00Z'))).toEqual({ kind: 'later', dayOffset: 1, weekday: 'mon', time: '08:15' });
    // Monday 17:50: the preparation would end after closing at 18:00
    expect(collectionReadiness(store, new Date('2026-12-21T22:50:00Z'))).toMatchObject({ kind: 'later', dayOffset: 1, weekday: 'tue' });
    // Monday before opening
    expect(collectionReadiness(store, new Date('2026-12-21T11:00:00Z'))).toEqual({ kind: 'later', dayOffset: 0, weekday: 'mon', time: '08:15' });
    expect(collectionReadiness(store, new Date('2026-12-21T17:00:00Z'))).toEqual({ kind: 'ready', minutes: 15 });
    expect(collectionReadiness({ ...store, hours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null } }, new Date())).toEqual({ kind: 'closed' });
  });

  it('store change triggers refresh', async () => {
    vi.useRealTimers();
    await renderPdp(podPage(), { selectedKey: 'mcf-store-nyc-soho', extra: <Probe />, routes: { '/api/session/store': () => ({ ok: true }) } });
    expect(nav.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'pick-brooklyn' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1));
    expect(STORE_BK.key).toBe('mcf-store-brooklyn');
  });
});

describe('ship block', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  it('ship estimate before and after cut-off', async () => {
    vi.setSystemTime(new Date('2026-10-21T14:00:00Z')); // Wed 10:00 New York
    const a = await renderPdp(podPage());
    expect(screen.getByTestId('ship-block')).toHaveTextContent('Order in the next 4 hours for delivery by Tuesday, Oct 27');
    a.unmount();
    vi.setSystemTime(new Date('2026-10-21T19:00:00Z')); // Wed 15:00
    await renderPdp(podPage());
    expect(screen.getByTestId('ship-block')).toHaveTextContent('Order now for delivery by Wednesday, Oct 28');
  });

  it('Variant out of stock: the block says so and gives the restock figure', async () => {
    const days = podPage();
    days.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 0, restockableInDays: 5 }) });
    const a = await renderPdp(days);
    expect(screen.getByTestId('ship-block')).toHaveTextContent('Out of stock online. Back in about 5 days');
    expect(addButton()).toHaveTextContent('Out of stock');
    expect(addButton()).toBeDisabled();
    a.unmount();
    const expected = podPage();
    expected.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 0, expectedDelivery: '2026-11-02T00:00:00.000Z' }) });
    const b = await renderPdp(expected);
    expect(screen.getByTestId('ship-block')).toHaveTextContent('Out of stock online. Expected Nov 2, 2026');
    b.unmount();
    const plain = podPage();
    plain.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 0 }) });
    await renderPdp(plain);
    expect(screen.getByTestId('ship-block').textContent).toBe('Out of stock online');
  });

  it('an inventory failure never claims stock', async () => {
    await renderPdp(podPage({ inventoryFailed: true }));
    expect(screen.getByTestId('ship-block')).toHaveTextContent('Stock could not be checked right now.');
    expect(addButton()).toHaveTextContent('Stock could not be checked');
    expect(addButton()).toBeDisabled();
  });
});

describe('subscribe block', () => {
  it('policies without a price are not offered', async () => {
    const data = podPage();
    data.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { recurring: [{ policyId: 'rp-1m', value: usd(531) }] });
    const user = userEvent.setup();
    await renderPdp(data);
    await user.click(radio(/Subscribe and save/) as HTMLElement);
    const options = within(screen.getByRole('combobox', { name: 'Delivery interval' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Every month']);
    expect(screen.getByTestId('subscribe-price')).toHaveTextContent('$5.31 per delivery');
    expect(addButton()).toHaveTextContent('Subscribe - $5.31');
  });

  it('lists the intervals, shows the recurring price and follows the chosen one', async () => {
    const user = userEvent.setup();
    await renderPdp(podPage());
    await user.click(radio(/Subscribe and save/) as HTMLElement);
    const select = screen.getByRole('combobox', { name: 'Delivery interval' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Every 2 weeks', 'Every month']);
    await user.selectOptions(select, 'Every month');
    expect(radio(/Every month, skip or cancel any time/)).toBeInTheDocument();
    expect(screen.getByText('Skip or cancel any time in your account')).toBeInTheDocument();
    expect(screen.getByText('$5.90 one time')).toBeInTheDocument();
  });

  it('interval label singular and plural', () => {
    const t = (key: string, v: { count: number }) =>
      ({ 'interval.weeks': v.count === 1 ? 'Every week' : `Every ${v.count} weeks`, 'interval.months': v.count === 1 ? 'Every month' : `Every ${v.count} months`, 'interval.days': `Every ${v.count} days` })[key] ?? key;
    expect(formatInterval({ unit: 'Weeks', value: 1 }, t as never)).toBe('Every week');
    expect(formatInterval({ unit: 'Weeks', value: 2 }, t as never)).toBe('Every 2 weeks');
    expect(formatInterval({ unit: 'Months', value: 1 }, t as never)).toBe('Every month');
    expect(formatInterval({ unit: 'Months', value: 3 }, t as never)).toBe('Every 3 months');
  });

  it('the real catalogue words singular and plural intervals', async () => {
    const data = podPage();
    data.policies = [
      { id: 'rp-2w', key: 'a', name: '', schedule: { unit: 'Weeks', value: 1 } },
      { id: 'rp-1m', key: 'b', name: '', schedule: { unit: 'Months', value: 3 } },
    ];
    const user = userEvent.setup();
    await renderPdp(data);
    await user.click(radio(/Subscribe and save/) as HTMLElement);
    const options = within(screen.getByRole('combobox', { name: 'Delivery interval' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Every week', 'Every 3 months']);
  });

  it('a variant with no price disables Collect and Subscribe', async () => {
    const data = podPage();
    data.product.variants = data.product.variants.map((v) => ({ ...v, price: null }));
    await renderPdp(data, { selectedKey: 'mcf-store-nyc-soho' });
    expect(radio(/Collect in store/)).toHaveAttribute('aria-disabled', 'true');
    expect(radio(/Delivery/)).not.toHaveAttribute('aria-disabled');
  });
});
