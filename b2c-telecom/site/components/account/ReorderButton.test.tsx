import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { ReorderButton } from './ReorderButton';

const answer = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  push.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('ReorderButton', () => {
  it('posts to the reorder route of the order and goes to My bundle when every line was reused', async () => {
    const fetchMock = answer({ cart: { id: 'new', lines: [] }, unavailable: [] });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ReorderButton orderNumber="QA-AAAA01" />);
    await userEvent.click(screen.getByRole('button', { name: 'Buy again' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/bundle'));
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/QA-AAAA01/reorder', expect.objectContaining({ method: 'POST' }));
    expect(await screen.findByText('We created a new bundle from this order.')).toBeInTheDocument();
  });

  it('lists the items that could not be added before going to My bundle', async () => {
    vi.stubGlobal('fetch', answer({ cart: { id: 'new', lines: [] }, unavailable: [{ sku: 'MLV-QA', name: 'QA add-on', reason: 'not-available' }] }));
    renderWithProviders(<ReorderButton orderNumber="QA-AAAA01" />);
    await userEvent.click(screen.getByRole('button', { name: 'Buy again' }));
    expect(await screen.findByText('These items could not be added: QA add-on.', undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to My bundle', hidden: true }));
    expect(push).toHaveBeenCalledWith('/bundle');
  });

  it('says so when the order could not be reused and stays on the page', async () => {
    vi.stubGlobal('fetch', answer({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404));
    renderWithProviders(<ReorderButton orderNumber="NOPE" />);
    await userEvent.click(screen.getByRole('button', { name: 'Buy again' }));
    expect(await screen.findByText('We could not reuse this order. Try again in a moment.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Buy again' })).toBeEnabled();
  });
});
