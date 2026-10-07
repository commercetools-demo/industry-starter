import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOrder } from '@/hooks/useOrders';
import type { Order, Proposal, ProposalsResponse } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { LineRemovalTag, OrderSubstitutions } from './OrderSubstitutions';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const order = { id: 'order-1', lines: [], inventoryMode: 'None', version: 3 } as unknown as Order;
const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  editId: 'edit-1',
  originalLineItemId: 'l1',
  originalName: 'Bananas',
  substituteSku: 'PLANTAINS-500G',
  substituteName: 'Plantains',
  priceDifference: usd(30),
  newTotal: usd(1077),
  editable: true,
  ...over,
});

type Server = { state: ProposalsResponse; postStatus?: number; postBody?: unknown };

/** Plays the server: the proposals state is mutable so the refetch after a POST sees the new state. */
function stubServer(server: Server, onPost?: (url: string) => void) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      onPost?.(url);
      return new Response(JSON.stringify(server.postBody ?? { ok: true }), { status: server.postStatus ?? 200 });
    }
    if (url.includes('/proposals')) return new Response(JSON.stringify(server.state));
    return new Response(JSON.stringify({ order }));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const posts = (fn: ReturnType<typeof stubServer>) => fn.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url);

const orderFetches = (fn: ReturnType<typeof stubServer>) => fn.mock.calls.filter(([url]) => url === '/api/account/orders/order-1').length;
/** Stands in for the order detail page, which owns the order cache. */
function OrderProbe() {
  useOrder('order-1');
  return null;
}

afterEach(() => vi.unstubAllGlobals());

describe('OrderSubstitutions', () => {
  it('no proposals: renders nothing', async () => {
    const fn = stubServer({ state: { proposals: [], removalRequested: [] } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(screen.queryByTestId('order-substitutions')).not.toBeInTheDocument();
  });

  it('Proposal exists: notice with original, substitute, price difference, new total and both actions', async () => {
    stubServer({ state: { proposals: [proposal()], removalRequested: [] } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    expect(await screen.findByText("We couldn't find Bananas. Proposed: Plantains (+$0.30)")).toBeInTheDocument();
    expect(screen.getByText('New total: $10.77')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept the substitute for Bananas' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Decline the substitute for Bananas' })).toBeEnabled();
  });

  it('negative and zero price differences', async () => {
    stubServer({ state: { proposals: [proposal({ priceDifference: usd(-47) }), proposal({ editId: 'e2', priceDifference: usd(0), substituteName: 'Same' })], removalRequested: [] } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    expect(await screen.findByText(/Proposed: Plantains \(-\$0\.47\)/)).toBeInTheDocument();
    expect(screen.getByText(/Proposed: Same \(no price difference\)/)).toBeInTheDocument();
  });

  it('Accept: posts to the accept endpoint, then refetches the order', async () => {
    const server: Server = { state: { proposals: [proposal()], removalRequested: [] } };
    const fn = stubServer(server, () => {
      server.state = { proposals: [], removalRequested: [] };
    });
    renderWithProviders(
      <>
        <OrderProbe />
        <OrderSubstitutions order={order} />
      </>,
    );
    await waitFor(() => expect(orderFetches(fn)).toBe(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept the substitute for Bananas' }));
    await waitFor(() => expect(screen.queryByTestId('proposal')).not.toBeInTheDocument());
    expect(posts(fn)).toEqual(['/api/account/proposals/edit-1/accept']);
    await waitFor(() => expect(orderFetches(fn)).toBe(2));
  });

  it('Decline: posts to decline, the notice goes and the line shows "Removal requested"', async () => {
    const server: Server = { state: { proposals: [proposal()], removalRequested: [] } };
    const fn = stubServer(server, () => {
      server.state = { proposals: [], removalRequested: ['l1'] };
    });
    renderWithProviders(
      <>
        <OrderSubstitutions order={order} />
        <LineRemovalTag orderId="order-1" lineId="l1" />
        <LineRemovalTag orderId="order-1" lineId="l2" />
      </>,
    );
    expect(screen.queryByText('Removal requested')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Decline the substitute for Bananas' }));
    await waitFor(() => expect(screen.getAllByText('Removal requested')).toHaveLength(1));
    expect(screen.queryByTestId('proposal')).not.toBeInTheDocument();
    expect(posts(fn)).toEqual(['/api/account/proposals/edit-1/decline']);
  });

  it('Stale version: explains, refetches and shows the current state', async () => {
    const server: Server = { state: { proposals: [proposal()], removalRequested: [] }, postStatus: 409, postBody: { error: 'STALE' } };
    const fn = stubServer(server, () => {
      server.state = { proposals: [proposal({ editId: 'edit-2', substituteName: 'Fresh plantains' })], removalRequested: [] };
    });
    renderWithProviders(<OrderSubstitutions order={order} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept the substitute for Bananas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This order changed since the proposal was made');
    expect(await screen.findByText(/Fresh plantains/)).toBeInTheDocument();
    expect(fn.mock.calls.filter(([url]) => String(url).includes('/proposals')).length).toBeGreaterThanOrEqual(2);
  });

  it('server says NOT_EDITABLE: explains it', async () => {
    stubServer({ state: { proposals: [proposal()], removalRequested: [] }, postStatus: 422, postBody: { error: 'NOT_EDITABLE' } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Decline the substitute for Bananas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be changed');
  });

  it('other failure: generic message and the buttons work again', async () => {
    stubServer({ state: { proposals: [proposal()], removalRequested: [] }, postStatus: 500, postBody: { error: 'PROPOSALS_ERROR' } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept the substitute for Bananas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save your choice');
    expect(screen.getByRole('button', { name: 'Accept the substitute for Bananas' })).toBeEnabled();
  });

  it('Order already shipped: read-only text and a contact link, no Accept or Decline', async () => {
    stubServer({ state: { proposals: [proposal({ editable: false })], removalRequested: [] } });
    renderWithProviders(<OrderSubstitutions order={order} />);
    expect(await screen.findByText(/can no longer be changed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', expect.stringContaining('/contact'));
    expect(screen.queryByRole('button', { name: /Accept|Decline/ })).not.toBeInTheDocument();
  });

  it('German: notice and actions are translated', async () => {
    stubServer({ state: { proposals: [proposal()], removalRequested: [] } });
    renderWithProviders(<OrderSubstitutions order={order} />, { locale: 'de-DE' });
    expect(await screen.findByRole('button', { name: 'Ersatz für Bananas annehmen' })).toBeInTheDocument();
    expect(screen.getByText(/Wir konnten Bananas nicht finden/)).toBeInTheDocument();
  });
});
