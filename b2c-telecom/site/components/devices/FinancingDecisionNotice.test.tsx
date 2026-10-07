import { fireEvent, screen, waitFor } from '@testing-library/react';
import { usd } from '@/lib/devices/__fixtures__/devices';
import type { FinancingDecision } from '@/lib/types';
import { makeCart } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { FinancingDecisionNotice } from './FinancingDecisionNotice';

const decision = (patch: Partial<FinancingDecision> = {}): FinancingDecision => ({
  decisionId: 'stub-00000001',
  outcome: 'declined',
  reason: 'amount-over-limit',
  financedTotal: usd(356400),
  limit: usd(250000),
  decidedAt: '2026-10-07T12:00:00.000Z',
  ...patch,
});
const LINES = [
  { id: 'D1', name: 'Nova Pro' },
  { id: 'D2', name: 'Nova 5G' },
];
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

afterEach(() => vi.unstubAllGlobals());

describe('FinancingDecisionNotice', () => {
  it('over the limit: says why, names the limit and offers pay in full for every financed line', () => {
    renderWithProviders(<FinancingDecisionNotice decision={decision()} lines={LINES} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'We could not approve financing for this bundle.' })).toBeInTheDocument();
    expect(screen.getByText('The financed total is above your limit of $2,500.00.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Pay in full instead/ })).toHaveLength(2);
  });

  it('a declined customer gets the account reason', () => {
    renderWithProviders(<FinancingDecisionNotice decision={decision({ reason: 'customer-declined' })} lines={LINES} />);
    expect(screen.getByText('Financing is not available for this account.')).toBeInTheDocument();
  });

  it('renders nothing for an approved or a sign-in-required decision', () => {
    for (const outcome of ['approved', 'sign-in-required'] as const) {
      const view = renderWithProviders(<FinancingDecisionNotice decision={decision({ outcome, reason: 'ok' })} lines={LINES} />);
      expect(screen.queryByRole('alert')).toBeNull();
      view.unmount();
    }
  });

  it('pay in full switches that line to pay in full and tells the checkout', async () => {
    const fetchMock = vi.fn(() => reply(200, { cart: makeCart({ lines: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    renderWithProviders(<FinancingDecisionNotice decision={decision()} lines={LINES} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pay in full instead: Nova 5G' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/devices/D2');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ mode: 'outright', termMonths: 0 }) });
  });

  it('a refusal stays on the notice in words and nothing is reported as changed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(422, { error: { code: 'PRICE_NOT_FOR_TERM', message: 'x' }, cart: null })));
    const onChanged = vi.fn();
    renderWithProviders(<FinancingDecisionNotice decision={decision()} lines={LINES} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pay in full instead: Nova Pro' }));
    expect(await screen.findByText('This device has no price for that term, so it was not added.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('speaks German with the limit in euro format', () => {
    renderWithProviders(<FinancingDecisionNotice decision={decision({ limit: { centAmount: 230000, currencyCode: 'EUR' } })} lines={LINES} />, { locale: 'de-DE' });
    expect(screen.getByText(/Der finanzierte Gesamtbetrag liegt über Ihrem Limit von 2\.300,00/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Stattdessen in einer Summe zahlen/ })).toHaveLength(2);
  });
});
