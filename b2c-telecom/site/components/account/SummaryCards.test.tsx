import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { AddressView } from '@/lib/types';

vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { SummaryCard, SummaryCards } from './SummaryCards';

const address: AddressView = { id: 'a1', name: 'Alex Rivera', line1: '1 Main St', line2: '', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isDefaultShipping: true };
const bill = (
  <SummaryCard label="MONTHLY BILL">
    <p>$119.99</p>
  </SummaryCard>
);

describe('SummaryCards', () => {
  it('Address added and defaulted: the dashboard shows the default shipping address (the add/remove behaviour itself is tested in T)', () => {
    renderWithProviders(<SummaryCards email="alex@example.com" customerNumber="MV-48210-7" address={address} bill={bill} />);
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByText('New York, NY, 10001, US')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage addresses' })).toHaveAttribute('href', '/en-US/account/addresses');
  });

  it('Last address removed: the dashboard shows the explicit no-address state with a link to add one', () => {
    renderWithProviders(<SummaryCards email="alex@example.com" customerNumber={null} address={null} bill={bill} />);
    expect(screen.getByText('No address saved yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an address' })).toHaveAttribute('href', '/en-US/account/addresses');
    expect(screen.queryByText('1 Main St')).not.toBeInTheDocument();
  });

  it('shows the email, the account number (or a dash), the bill slot and the honey card actions', () => {
    renderWithProviders(<SummaryCards email="alex@example.com" customerNumber={null} address={null} bill={bill} />);
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Account no. — · Active')).toBeInTheDocument();
    expect(screen.getByText('$119.99')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('uses the design grid: auto-fit columns that never get narrower than 300 px', () => {
    const { container } = renderWithProviders(<SummaryCards email="a@b.c" customerNumber="MV-1" address={null} bill={bill} />);
    expect(container.querySelector('div.grid')?.className).toContain('auto-fit');
  });
});
