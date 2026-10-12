import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { hardNavigate } from '@/hooks/navigate';

vi.mock('@/hooks/navigate', () => ({ hardNavigate: vi.fn() }));

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/sign-in',
  useRouter: () => ({ ...router, prefetch: vi.fn() }),
}));

import { DemoLogin } from './DemoLogin';

const ACCOUNTS = [
  { id: 'a1', label: 'Alex Admin · Admin · Test Garage Nord', group: 'Test Garage Nord' },
  { id: 'b1', label: 'Bea Buyer · Buyer · Test Garage Nord', group: 'Test Garage Nord' },
  { id: 'a2', label: 'Sam Admin · Admin · Test Garage Süd', group: 'Test Garage Süd' },
];

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.mocked(hardNavigate).mockClear();
  router.replace.mockReset();
  router.refresh.mockReset();
});

const accountsResponse = (accounts: unknown[]) => fetchMock.mockImplementation(async (url: string) => (url.includes('demo-accounts') ? Response.json({ accounts }) : Response.json({ status: 'ok' })));
const render = () => renderWithProviders(<DemoLogin />, { messages: en });

describe('DemoLogin', () => {
  it('grouped by business unit', async () => {
    accountsResponse(ACCOUNTS);
    const { container } = render();
    const select = await screen.findByLabelText('Demo account');
    const groups = within(select).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Test Garage Nord', 'Test Garage Süd']);
    expect(within(groups[0]).getAllByRole('option').map((o) => o.textContent)).toEqual([ACCOUNTS[0].label, ACCOUNTS[1].label]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('button disabled until selection', async () => {
    accountsResponse(ACCOUNTS);
    render();
    const button = await screen.findByRole('button', { name: 'Sign in as demo user' });
    expect(button).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Demo account'), 'a1');
    expect(button).toBeEnabled();
  });

  it('empty state', async () => {
    accountsResponse([]);
    render();
    expect(await screen.findByText('No demo accounts found. Run the seed.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('sends only the account id and continues to the portal', async () => {
    accountsResponse(ACCOUNTS);
    render();
    await userEvent.selectOptions(await screen.findByLabelText('Demo account'), 'a1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as demo user' }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/de-DE'));
    const post = fetchMock.mock.calls.find(([url]) => url === '/api/auth/demo-login')!;
    expect(JSON.parse(post[1].body)).toEqual({ customerId: 'a1' });
  });

  it('error announced', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.includes('demo-accounts') ? Response.json({ accounts: ACCOUNTS }) : Response.json({ error: 'x' }, { status: 401 })));
    render();
    await userEvent.selectOptions(await screen.findByLabelText('Demo account'), 'a1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as demo user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo sign-in failed. Try again.');
    expect(hardNavigate).not.toHaveBeenCalled();
  });
});
