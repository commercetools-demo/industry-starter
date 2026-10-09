import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { CancelOrder } from './CancelOrder';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => router }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let answer: Response;
beforeEach(() => {
  Object.values(router).forEach((fn) => fn.mockReset());
  answer = json({ id: 'o1', status: 'cancelled' });
  vi.stubGlobal('fetch', vi.fn(async () => answer));
});
afterEach(() => vi.unstubAllGlobals());

describe('post-purchase-order-management: cancel control', () => {
  it('asks first; nothing is sent until the buyer confirms', async () => {
    renderWithProviders(<CancelOrder orderId="o1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByText(/Your prescription refill is given back/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Keep my order' }));
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('confirming posts once and refreshes the page so it shows the cancelled state', async () => {
    renderWithProviders(<CancelOrder orderId="o1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the order' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/orders/o1/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('too late (409): says the order is already packed and refreshes to show the real state', async () => {
    answer = json({ error: 'x', code: 'too-late' }, 409);
    renderWithProviders(<CancelOrder orderId="o1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already packed');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('any other failure is reported and the order stays as it was', async () => {
    answer = json({ error: 'x' }, 500);
    renderWithProviders(<CancelOrder orderId="o1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel the order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not cancel this order');
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
