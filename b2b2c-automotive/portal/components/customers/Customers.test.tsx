import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { CustomerDetail as Detail, CustomerList } from '@/lib/v-types';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { CustomerDetail } from './CustomerDetail';
import { CustomersPage } from './CustomersPage';

const api = vi.hoisted(() => ({
  list: { current: null as unknown },
  detail: { current: null as unknown },
  lastTab: { current: '' },
  addNote: vi.fn(),
  shopAs: vi.fn(),
  markDelivered: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/hooks/vApi', () => ({
  useCustomers: (_s: string, tab: string) => {
    api.lastTab.current = tab;
    const list = api.list.current as CustomerList;
    return { data: { ...list, rows: list.rows.filter((r) => (tab === 'all' ? true : tab === 'guests' ? r.type === 'Guest' : r.type === 'Registered')) }, error: undefined };
  },
  useCustomerDetail: () => ({ data: api.detail.current, error: undefined, mutate: vi.fn() }),
  customerApi: { addNote: (...a: unknown[]) => api.addNote(...a), shopAs: (...a: unknown[]) => api.shopAs(...a), markDelivered: (...a: unknown[]) => api.markDelivered(...a) },
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: api.refresh }),
}));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage', storeKey: 'store-a', storeName: 'DACH Online' };
const screenOf = (ui: ReactNode) =>
  renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );

const list: CustomerList = {
  rows: [
    { id: 'c-1', name: 'Anna Muster', email: 'a***@e***.com', type: 'Registered', orders: 2, lifetimeCents: 12000, currency: 'EUR', lastOrderAt: '2026-10-01T00:00:00Z' },
    { id: null, name: 'Gast Besteller', email: 'g***@e***.com', type: 'Guest', orders: 1, lifetimeCents: 4500, currency: 'EUR', lastOrderAt: '2026-09-01T00:00:00Z' },
  ],
  total: 2,
  kpis: { registered: 1, guests: 1, repeatRate: 50 },
  truncated: false,
};
const detail: Detail = {
  id: 'c-1',
  name: 'Anna Muster',
  email: 'anna.muster@example.com',
  mobile: '+49 151 0000',
  createdAt: '2026-01-01T00:00:00Z',
  marketingConsent: true,
  marketingConsentAt: '2026-02-01T00:00:00Z',
  orders: [
    { id: 'o1', orderNumber: 'MLV-101', createdAt: '2026-09-01T00:00:00Z', totalCents: 5900, currency: 'EUR', state: 'Open', deliveredAt: null },
    { id: 'o2', orderNumber: 'MLV-100', createdAt: '2026-08-01T00:00:00Z', totalCents: 2500, currency: 'EUR', state: 'Open', deliveredAt: '2026-08-05T00:00:00Z' },
  ],
  garage: [{ id: 'v1', label: '2016 Volkswagen Golf · 2.0 TDI' }],
  subscriptions: [],
  returns: [],
  notes: [],
};

beforeEach(() => {
  api.list.current = list;
  api.detail.current = detail;
  for (const f of [api.addNote, api.shopAs, api.markDelivered, api.refresh]) f.mockReset();
});

describe('Customers list', () => {
  it('shows masked e-mail addresses, the KPIs, and the Guests tab only guests with the caption', async () => {
    const { container } = screenOf(<CustomersPage />);
    expect(screen.getByText('a***@e***.com')).toBeInTheDocument();
    expect(screen.queryByText('anna.muster@example.com')).toBeNull();
    expect(within(screen.getByTestId('kpi-repeat')).getByTestId('kpi-repeat-value')).toHaveTextContent('50.0 %');
    await userEvent.click(screen.getByRole('tab', { name: 'Guests' }));
    expect(screen.getByText('Gast Besteller')).toBeInTheDocument();
    expect(screen.queryByText('Anna Muster')).toBeNull();
    expect(screen.getByText('Checked out without an account')).toBeInTheDocument();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('only registered customers link to their detail', () => {
    screenOf(<CustomersPage />);
    expect(screen.getByRole('link', { name: 'Open Anna Muster' })).toHaveAttribute('href', '/customers/c-1');
    expect(screen.queryByRole('link', { name: /Gast Besteller/ })).toBeNull();
  });
});

describe('Customer detail', () => {
  it('shows the full e-mail, orders, garage, consent, and Mark delivered only for an undelivered order', async () => {
    const { container } = screenOf(<CustomerDetail id="c-1" />);
    expect(screen.getByTestId('customer-email')).toHaveTextContent('anna.muster@example.com');
    expect(screen.getByText('2016 Volkswagen Golf · 2.0 TDI')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark delivered' })).toHaveLength(1);
    api.markDelivered.mockResolvedValue({ ok: true, status: 200, data: { deliveredAt: 'x' } });
    await userEvent.click(screen.getByRole('button', { name: 'Mark delivered' }));
    expect(api.markDelivered).toHaveBeenCalledWith('store-a', 'MLV-101');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('shows "No vehicles saved" without a garage and adds a note', async () => {
    api.detail.current = { ...detail, garage: [] };
    api.addNote.mockResolvedValue({ ok: true, status: 201, data: { notes: [] } });
    screenOf(<CustomerDetail id="c-1" />);
    expect(screen.getByText('No vehicles saved')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New note'), 'TST-V-note');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(api.addNote).toHaveBeenCalledWith('store-a', 'c-1', 'TST-V-note');
  });

  it('Shop as customer POSTs the token in a form body to the storefront in a new tab, never in a URL', async () => {
    api.shopAs.mockResolvedValue({ ok: true, status: 200, data: { action: 'https://shop.example.com/api/impersonate', token: 'jwt-token' } });
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      expect(this.method).toBe('post');
      expect(this.action).toBe('https://shop.example.com/api/impersonate');
      expect(this.action).not.toContain('jwt-token');
      expect(this.target).toBe('_blank');
      expect((this.elements.namedItem('token') as HTMLInputElement).value).toBe('jwt-token');
    });
    screenOf(<CustomerDetail id="c-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Shop as customer' }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(api.refresh).toHaveBeenCalled();
    submit.mockRestore();
  });

  it('says when shop as is not set up and submits nothing', async () => {
    api.shopAs.mockResolvedValue({ ok: false, status: 409, data: null, code: 'NOT_CONFIGURED' });
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
    screenOf(<CustomerDetail id="c-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Shop as customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not set up yet');
    expect(submit).not.toHaveBeenCalled();
    submit.mockRestore();
  });
});
