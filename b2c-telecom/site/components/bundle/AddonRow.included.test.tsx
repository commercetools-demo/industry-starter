import { screen } from '@testing-library/react';
import { addonLine } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { AddonRow } from './AddonRow';

const row = (line: ReturnType<typeof addonLine>) => (
  <ul>
    <AddonRow line={line} planName="Cable 500" onRemove={vi.fn()} />
  </ul>
);

describe('AddonRow: included line', () => {
  it('a line the plan includes shows "Included at no charge" and has no remove control (it goes with the plan)', () => {
    renderWithProviders(row(addonLine({ includedAtNoCharge: true })));
    expect(screen.getByText('Included at no charge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('a paid add-on keeps its remove control', () => {
    renderWithProviders(row(addonLine()));
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
  });
});
