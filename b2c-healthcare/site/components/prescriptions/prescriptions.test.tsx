import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/utils';
import { usd } from '@/test/rx-fixtures-for-tests';
import type { RxLineView, RxView } from '@/lib/types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import type { AddRxLines } from '@/hooks/use-cart';
import { RxLookup } from './RxLookup';

const row = (over: Partial<RxLineView> & Pick<RxLineView, 'lineRef' | 'name'>): RxLineView => ({
  sig: '1 tablet daily',
  qty: 30,
  price: usd(1000),
  status: 'ok',
  selectable: true,
  minShelfLifeMonths: null,
  ...over,
});

const view = (lines: RxLineView[], over: Partial<RxView> = {}): RxView => ({
  number: 'RX-77102',
  prescriber: 'Dr. Sofia Marchetti',
  issuedAt: '2026-09-24',
  refillsLeft: 3,
  patientName: 'Sam Rivera',
  lines,
  ...over,
});

const OK_VIEW = view([
  row({ lineRef: 'a', name: 'Atorvastatin 20 mg tablets', sig: '1 tablet nightly', price: usd(1875) }),
  row({ lineRef: 'b', name: 'Lisinopril 10 mg tablets', sig: '1 tablet each morning', price: usd(1140) }),
]);

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const add = vi.fn();
const totalText = () => document.querySelector('[data-total]')?.textContent;
async function search(input: string, picks: { number: string; issuedAt: string }[] = [], addFn: AddRxLines = add) {
  const user = userEvent.setup();
  renderWithProviders(<RxLookup quickPicks={picks} addRxLines={addFn} />);
  await user.type(screen.getByRole('textbox', { name: 'RX number' }), input);
  await user.click(screen.getByRole('button', { name: 'Search' }));
  return user;
}

describe('design-plp › Prescription lookup by RX number: Before searching', () => {
  it('shows a muted card and nothing else', () => {
    renderWithProviders(<RxLookup quickPicks={[]} addRxLines={add} />);
    expect(screen.getByText('Your medications will appear here after you search.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('design-plp › Prescription lookup by RX number: Lookup', () => {
  it('posts the number in the body, never in the URL, and shows the card', async () => {
    answer(200, OK_VIEW);
    await search('rx 77102');
    expect(await screen.findByRole('heading', { name: 'RX-77102' })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/prescriptions/lookup');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ rx: 'rx 77102' });
    expect(url).not.toContain('77102');
    expect(screen.getByText('Prescribed by Dr. Sofia Marchetti · September 24, 2026')).toBeInTheDocument();
    expect(screen.getByText('Patient: Sam Rivera')).toBeInTheDocument();
    expect(screen.getByText('3 refills left')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all medications' })).toBeChecked();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Atorvastatin 20 mg tablets')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1 tablet nightly')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Qty 30')).toBeInTheDocument();
    expect(within(rows[0]).getByText('$18.75')).toBeInTheDocument();
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    expect(totalText()).toBe('$30.15');
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });

  it('nothing about the lookup reaches the console or storage', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    answer(200, OK_VIEW);
    await search('RX-77102');
    await screen.findByRole('heading', { name: 'RX-77102' });
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  });
});

describe('design-plp › Prescription lookup by RX number: Unknown or foreign RX', () => {
  it('Unknown or foreign RX: the same message for both, with the input as text (not markup)', async () => {
    answer(404, { code: 'NOT_FOUND', error: 'ignored' });
    await search('RX-00000');
    const unknown = (await screen.findByRole('alert')).textContent;
    expect(unknown).toBe('We couldn’t find “RX-00000”. Check the number printed on your prescription.');
    expect(screen.queryByRole('heading', { name: /RX-/ })).toBeNull();
  });

  it('echoes markup as plain text', async () => {
    answer(404, { code: 'NOT_FOUND' });
    await search('<b>x</b>');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('“<b>x</b>”');
    expect(alert.querySelector('b')).toBeNull();
  });

  it('rate limited: says so and shows no card', async () => {
    answer(429, { code: 'RATE_LIMITED' });
    await search('RX-00000');
    expect(await screen.findByText('Too many lookups. Please try again in a few minutes.')).toBeInTheDocument();
  });

  it('a network failure shows a retryable error, not the not-found text', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await search('RX-77102');
    expect(await screen.findByText('We could not look up your prescription. Please try again.')).toBeInTheDocument();
  });
});

describe('design-plp › Prescription lookup by RX number: Selection', () => {
  it('unchecking rows updates the count, total and select-all; Add to cart is disabled when none are selected', async () => {
    answer(200, OK_VIEW);
    const user = await search('RX-77102');
    await screen.findByRole('heading', { name: 'RX-77102' });
    const selectAll = screen.getByRole('checkbox', { name: 'Select all medications' });
    await user.click(screen.getByRole('checkbox', { name: /Lisinopril/ }));
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    expect(totalText()).toBe('$18.75');
    expect(selectAll).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Atorvastatin/ }));
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    await user.click(selectAll);
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    expect(totalText()).toBe('$30.15');
    await user.click(selectAll);
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
  });
});

describe('design-plp › Prescription lookup by RX number: Add to cart', () => {
  beforeEach(() => add.mockReset().mockResolvedValue(undefined));

  it('adds only the selected lines and shows the toast "Added to cart · View cart →" for 5 seconds', async () => {
    answer(200, OK_VIEW);
    const user = await search('RX-77102');
    await screen.findByRole('heading', { name: 'RX-77102' });
    await user.click(screen.getByRole('checkbox', { name: /Lisinopril/ }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(screen.getByRole('button', { name: 'Add to cart' }));
      expect(add).toHaveBeenCalledExactlyOnceWith('RX-77102', ['a']);
      const toast = await waitFor(() => {
        const el = document.querySelector('[data-toast]');
        expect(el).not.toBeNull();
        return el as HTMLElement;
      });
      expect(toast).toHaveTextContent('Added to cart');
      expect(within(toast).getByRole('link', { name: 'View cart →' })).toHaveAttribute('href', '/en-US/cart');
      act(() => {
        vi.advanceTimersByTime(4900);
      });
      expect(document.querySelector('[data-toast]')).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(document.querySelector('[data-toast]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a refused add keeps the card and says so', async () => {
    answer(200, OK_VIEW);
    const user = await search('RX-77102', [], () => Promise.reject(new Error('refused')));
    await screen.findByRole('heading', { name: 'RX-77102' });
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('We could not add these medications to your cart. Please try again.')).toBeInTheDocument();
    expect(document.querySelector('[data-toast]')).toBeNull();
  });
});

describe('design-plp › Prescription lookup by RX number: Medication that cannot be dispensed', () => {
  const MIXED = view(
    [
      row({ lineRef: 'a', name: 'Amoxicillin', status: 'NO_REFILLS', selectable: false, remaining: 0 }),
      row({ lineRef: 'b', name: 'Sertraline', status: 'EXPIRED', selectable: false }),
      row({ lineRef: 'c', name: 'Cetirizine', status: 'OUT_OF_STOCK', selectable: false, remaining: 0 }),
      row({ lineRef: 'd', name: 'Ibuprofen', status: 'CEILING', selectable: false, ceiling: 3, remaining: 1, scope: 'period' }),
      row({ lineRef: 'e', name: 'Azithromycin', status: 'CEILING', selectable: false, ceiling: 2, remaining: 2, scope: 'order' }),
      row({ lineRef: 'f', name: 'Famotidine', status: 'SHELF_LIFE', selectable: false, expiryDate: '2026-11-15' }),
      row({ lineRef: 'g', name: 'Metformin', status: 'NO_REFILLS', selectable: false, remaining: 30 }),
      row({ lineRef: 'h', name: 'Lisinopril', minShelfLifeMonths: 3 }),
    ],
    { refillsLeft: 0 },
  );

  it('rows keep their place, show the reason and cannot be selected', async () => {
    answer(200, MIXED);
    await search('RX-48213');
    await screen.findByRole('heading', { name: 'RX-77102' });
    const reasons: [RegExp, string][] = [
      [/Amoxicillin/, 'No refills left'],
      [/Sertraline/, 'This prescription has expired'],
      [/Cetirizine/, 'Out of stock'],
      [/Ibuprofen/, 'Monthly limit of 3 reached · 1 available this calendar month'],
      [/Azithromycin/, 'Limit of 2 per order · 2 available'],
      [/Famotidine/, 'Stock expires November 15, 2026, too soon to meet the minimum shelf life'],
      [/Metformin/, 'Only 30 left on this prescription'],
    ];
    for (const [name, reason] of reasons) {
      const box = screen.getByRole('checkbox', { name });
      expect(box).toBeDisabled();
      expect(box).not.toBeChecked();
      expect(box).toHaveAccessibleDescription(expect.stringContaining(reason));
    }
    expect(screen.getByRole('checkbox', { name: /Lisinopril/ })).toBeEnabled();
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    expect(screen.getByText('Minimum 3 months of shelf life on delivery')).toBeInTheDocument();
    expect(screen.getByText('Limits count calendar months.')).toBeInTheDocument();
  });

  it('a card with nothing dispensable has select-all disabled and Add to cart disabled', async () => {
    answer(200, view([row({ lineRef: 'a', name: 'Amoxicillin', status: 'NO_REFILLS', selectable: false, remaining: 0 })], { number: 'RX-48213', refillsLeft: 0 }));
    await search('RX-48213');
    await screen.findByRole('heading', { name: 'RX-48213' });
    expect(screen.getByRole('checkbox', { name: 'Select all medications' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    expect(screen.getByText('0 refills left')).toBeInTheDocument();
  });

  it('expiry-dated-supply › Short dated stock offered on its own terms: shows the actual expiry and its own price, selectable', async () => {
    answer(200, view([row({ lineRef: 'a', name: 'Famotidine', status: 'short-dated', expiryDate: '2026-11-15', price: usd(700), minShelfLifeMonths: 3 })]));
    await search('RX-77102');
    await screen.findByRole('heading', { name: 'RX-77102' });
    expect(screen.getByRole('checkbox', { name: /Famotidine/ })).toBeEnabled();
    expect(screen.getByText('Short-dated · expires November 15, 2026')).toBeInTheDocument();
    expect(screen.getAllByText('$7.00').length).toBeGreaterThan(0);
  });

  it('expiry-dated-supply › Remaining life shown before commitment / Undated goods unaffected', async () => {
    answer(200, view([row({ lineRef: 'a', name: 'Dated', minShelfLifeMonths: 3 }), row({ lineRef: 'b', name: 'Undated', minShelfLifeMonths: null })]));
    await search('RX-77102');
    await screen.findByRole('heading', { name: 'RX-77102' });
    expect(screen.getAllByText(/of shelf life on delivery/)).toHaveLength(1);
  });
});

describe('design-plp › Prescription lookup by RX number: Quick-pick badges', () => {
  it('lists the patient own prescriptions, not the prototype demo badges, and a click looks that one up', async () => {
    answer(200, OK_VIEW);
    const user = userEvent.setup();
    renderWithProviders(<RxLookup quickPicks={[{ number: 'RX-77102', issuedAt: '2026-09-24' }]} addRxLines={add} />);
    expect(screen.queryByText('RX-48213')).toBeNull();
    expect(screen.queryByText('Try:')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'RX-77102' }));
    expect(await screen.findByRole('heading', { name: 'RX-77102' })).toBeInTheDocument();
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({ rx: 'RX-77102' });
  });

  it('without prescriptions of its own no quick-picks are shown', () => {
    renderWithProviders(<RxLookup quickPicks={[]} addRxLines={add} />);
    expect(screen.queryByText('Your prescriptions:')).toBeNull();
  });
});
