import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Partnership } from '@/hooks/marketingApi';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { PartnershipPage } from './PartnershipPage';

const state = vi.hoisted(() => ({ data: undefined as unknown, error: undefined as unknown }));
vi.mock('@/hooks/marketingApi', () => ({ usePartnership: () => ({ data: state.data, error: state.error }) }));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage', storeKey: 'store-a', storeName: 'DACH Online' };

const data = (over: Partial<Partnership> = {}): Partnership => ({
  rules: [{ id: 'fitment', state: 'Enforced' }, { id: 'price', state: 'Informational' }],
  kpis: { compliance: { score: null, checked: 0, flags: 0 }, claimsPending: 0 },
  flags: [],
  ...over,
});

const render = () =>
  renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <PartnershipPage />
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );

beforeEach(() => {
  state.data = data();
  state.error = undefined;
});

describe('PartnershipPage', () => {
  it('lists the fitment rule as Enforced and the price rule as Informational with the price note, and no percentage of list price', () => {
    const { container } = render();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Enforced');
    expect(items[1]).toHaveTextContent('Informational');
    expect(screen.getByText('Set any price above zero; the Malva list price is a reference.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d\s*%/);
    expect(container.textContent).not.toMatch(/floor|territor/i);
  });

  it('a null score shows a dash and "0 open flags"; the empty state reads "Nothing to fix"', () => {
    render();
    expect(screen.getByTestId('kpi-compliance')).toHaveTextContent('—');
    expect(screen.getByText('0 open flags')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-claims')).toHaveTextContent('0');
    expect(screen.getByText('Nothing to fix')).toBeInTheDocument();
  });

  it('a pending claim is flagged with part, SKU, reason, claimed vehicles and a View link to the fix page', async () => {
    state.data = data({
      kpis: { compliance: { score: 50, checked: 2, flags: 1 }, claimsPending: 1 },
      flags: [{ kind: 'fitment-claim', part: { key: 'k1', sku: 'TST-W-010', name: { 'en-US': 'Roof rack' } }, claimedVehicles: ['Volkswagen|Golf|2012|2019|1.4 TSI'], fixHref: '/import?tab=local&key=k1' }],
    });
    const { container } = render();
    expect(screen.getByTestId('kpi-compliance')).toHaveTextContent('50');
    expect(screen.getByText('1 open flag')).toBeInTheDocument();
    expect(screen.getByText('Roof rack')).toBeInTheDocument();
    expect(screen.getByText('TST-W-010')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Malva review')).toBeInTheDocument();
    expect(screen.getByText('Claimed vehicles: Volkswagen Golf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View TST-W-010' })).toHaveAttribute('href', expect.stringContaining('/import?tab=local&key=k1'));
    expect(screen.queryByText('Nothing to fix')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows a loading and an error state', () => {
    state.data = undefined;
    const { unmount } = render();
    expect(screen.getByRole('status')).toHaveTextContent('Loading brand partnership');
    unmount();
    state.error = new Error('x');
    render();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
  });
});
