import { screen } from '@testing-library/react';
import { deviceLine, usd } from '@/lib/devices/__fixtures__/devices';
import { renderWithProviders } from '@/test/utils';
import { AcquisitionTotals } from './AcquisitionTotals';

const outright = deviceLine('a', { mode: 'outright', termMonths: 0, endOfTerm: 'owned' }, usd(100800));
const installments = deviceLine('b', { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' }, usd(4950));
const lease = deviceLine('c', { mode: 'lease', termMonths: 24, endOfTerm: 'return' }, usd(3300), 2);

describe('AcquisitionTotals', () => {
  it('Mixed modes in one order: states the totals for each mode', () => {
    renderWithProviders(<AcquisitionTotals lines={[installments, outright]} />);
    expect(screen.getByText('Pay in full: 1 item(s), due today $1,008.00, monthly $0.00')).toBeInTheDocument();
    expect(screen.getByText('Installments: 1 item(s), due today $49.50, monthly $49.50')).toBeInTheDocument();
    expect(screen.queryByText(/^Lease:/)).toBeNull();
  });

  it('counts quantities and keeps the order outright, installments, lease', () => {
    renderWithProviders(<AcquisitionTotals lines={[lease, installments, outright]} />);
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Pay in full: 1 item(s), due today $1,008.00, monthly $0.00', 'Installments: 1 item(s), due today $49.50, monthly $49.50', 'Lease: 2 item(s), due today $33.00, monthly $33.00']);
  });

  it('renders nothing without a device line', () => {
    const { container } = renderWithProviders(<AcquisitionTotals lines={[{ ...outright, acquisition: undefined }]} />);
    expect(container.querySelector('section')).toBeNull();
  });

  it('speaks German', () => {
    renderWithProviders(<AcquisitionTotals lines={[outright]} />, { locale: 'de-DE' });
    expect(screen.getByText(/^Einmalzahlung: 1 Artikel, heute fällig 1\.008,00/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Geräte nach Zahlungsart' })).toBeInTheDocument();
  });
});
