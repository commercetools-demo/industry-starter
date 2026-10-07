import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

const getSession = vi.fn();
const getAccountFirstName = vi.fn();
vi.mock('@/lib/ct/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/account-name', () => ({ getAccountFirstName: (id: string) => getAccountFirstName(id) }));

import { AccountSlot } from './AccountSlot';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountSlot', () => {
  it('Anonymous buyer: no customer in the session reads Log in and never reads a customer', async () => {
    getSession.mockResolvedValue({ anonymousId: 'anon-1', cartId: 'cart-1' });
    renderWithProviders(await AccountSlot());
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/en-US/login');
    expect(getAccountFirstName).not.toHaveBeenCalled();
  });

  it('Signed-in buyer: reads the name of the session customer only', async () => {
    getSession.mockResolvedValue({ customerId: 'cust-7' });
    getAccountFirstName.mockResolvedValue('Alex');
    renderWithProviders(await AccountSlot());
    expect(screen.getByRole('link', { name: 'Hi, Alex' })).toHaveAttribute('href', '/en-US/account');
    expect(getAccountFirstName).toHaveBeenCalledWith('cust-7');
  });

  it('an empty first name falls back to My account', async () => {
    getSession.mockResolvedValue({ customerId: 'cust-7' });
    getAccountFirstName.mockResolvedValue('');
    renderWithProviders(await AccountSlot());
    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/en-US/account');
  });
});
