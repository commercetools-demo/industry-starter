import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AccountPlanLabels } from './AccountPlanLabels';
import { SAMPLE_LABEL } from './__fixtures__/label';

describe('AccountPlanLabels', () => {
  it('Label on the account page: one label per active plan and none for add-ons', () => {
    renderWithProviders(<AccountPlanLabels labels={[SAMPLE_LABEL, { ...SAMPLE_LABEL, id: 'MLV-PHN-UNL-24M', planName: 'Unlimited', kind: 'Phone plan' }]} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Broadband Facts: Unlimited' })).toBeInTheDocument();
    // add-ons have no label: nothing in the list can render one
    expect(screen.queryByText(/Spotify|Apple TV/)).not.toBeInTheDocument();
  });

  it('renders nothing for an empty list', () => {
    renderWithProviders(<AccountPlanLabels labels={[]} />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('Fee with a formula: the early-termination text is shown as stored, not recomputed', () => {
    renderWithProviders(<AccountPlanLabels labels={[SAMPLE_LABEL]} />);
    expect(screen.getByText('$10 x months remaining')).toBeInTheDocument();
  });
});
