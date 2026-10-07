import { screen } from '@testing-library/react';
import { label } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import type { ActivePlan } from '@/lib/types';

const catalog = vi.hoisted(() => ({ getAllOffers: vi.fn(), buildLabel: vi.fn() }));
vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: catalog.getAllOffers }));
vi.mock('@/lib/pricing/label', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/pricing/label')>()), buildLabel: catalog.buildLabel }));

import { PlanLabels } from './PlanLabels';

const plan = (key: string, name: string, stored: ReturnType<typeof label> | null): ActivePlan => ({ key, orderNumber: key, sku: `sku-${key}`, name, label: stored });

describe('PlanLabels', () => {
  it('renders one label per plan from the stored snapshot, none for add-ons (they never arrive)', () => {
    renderWithProviders(<PlanLabels plans={[plan('a', 'Cable 500', label('MLV-CA-101', 'Cable 500')), plan('b', 'Unlimited', label('MLV-PH-301', 'Unlimited'))]} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('article', { name: /Cable 500/ })).toHaveAttribute('data-plan-id', 'MLV-CA-101');
    expect(screen.queryByText(/Spotify/)).not.toBeInTheDocument();
  });

  it('says "Label not available for this order." for a plan without a snapshot', () => {
    renderWithProviders(<PlanLabels plans={[plan('a', 'Cable 500', label('MLV-CA-101', 'Cable 500')), plan('c', 'Air 5G', null)]} />);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText(/Label not available for this order\./)).toHaveTextContent('Air 5G · Label not available for this order.');
  });

  it('does not rebuild the label from the live catalog', () => {
    catalog.getAllOffers.mockResolvedValue([{ key: 'malva-offer-cable-500', name: 'Changed plan name' }]);
    renderWithProviders(<PlanLabels plans={[plan('a', 'Cable 500', label('MLV-CA-101', 'Cable 500'))]} />);
    expect(catalog.getAllOffers).not.toHaveBeenCalled();
    expect(catalog.buildLabel).not.toHaveBeenCalled();
    expect(screen.getByRole('article', { name: /Cable 500/ })).toBeInTheDocument();
    expect(screen.queryByText('Changed plan name')).not.toBeInTheDocument();
  });

  it('shows the label of the same plan ordered twice once', () => {
    renderWithProviders(<PlanLabels plans={[plan('a', 'Cable 500', label('MLV-CA-101', 'Cable 500')), plan('b', 'Cable 500', label('MLV-CA-101', 'Cable 500'))]} />);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});
