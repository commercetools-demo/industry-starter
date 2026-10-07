import { screen, within } from '@testing-library/react';
import { buildSchedule } from '@/lib/pricing/schedule';
import type { Money, PriceSchedule as PriceScheduleData } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { PriceSchedule } from './PriceSchedule';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const eur = (centAmount: number): Money => ({ centAmount, currencyCode: 'EUR' });

function schedule(patch: Partial<Parameters<typeof buildSchedule>[0]> = {}): PriceScheduleData {
  const result = buildSchedule({
    offerKey: 'malva-offer-cable-500',
    sku: 'MLV-CBL-500-24M',
    termMonths: 24,
    quantity: 1,
    standing: usd(5999),
    introApplied: false,
    monthToMonth: usd(6999),
    oneTimeDueNow: usd(2500),
    orderDate: '2026-10-07',
    ...patch,
  });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe('PriceSchedule', () => {
  it('committed term: every period row, due at order, the total over the term and the after-term sentence', () => {
    renderWithProviders(<PriceSchedule schedule={schedule()} locale="en-US" />);
    expect(screen.getByRole('heading', { name: 'Your price, month by month' })).toBeInTheDocument();
    expect(screen.getByText('Price locked for your 24-month term')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1] as HTMLElement).getByText('1-24')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('$59.99')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Due at order/ })).getByText('$84.99')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Total over 24 months/ })).getByText('$1,439.76')).toBeInTheDocument();
    expect(screen.getByText('After your 24-month term: $69.99/mo from Oct 7, 2028.')).toBeInTheDocument();
    expect(screen.getByText('Dates assume you order today; they are fixed when you place the order.')).toBeInTheDocument();
  });

  it('an intro schedule shows the promotional amount, the standing amount and the date the standing amount begins', () => {
    renderWithProviders(
      <PriceSchedule
        schedule={schedule({ offerKey: 'malva-offer-cable-100', sku: 'MLV-CBL-100-24M', standing: usd(3999), introApplied: true, monthToMonth: usd(4999) })}
        locale="en-US"
      />,
    );
    expect(screen.getByText('$29.99')).toBeInTheDocument();
    expect(screen.getByText('Introductory price')).toBeInTheDocument();
    expect(screen.getByText('$39.99')).toBeInTheDocument();
    expect(screen.getByText('Standard price')).toBeInTheDocument();
    expect(screen.getByText('1-6')).toBeInTheDocument();
    expect(screen.getByText('7-24')).toBeInTheDocument();
    expect(screen.getByText(/Apr 7, 2027 - Oct 6, 2028/)).toBeInTheDocument();
  });

  it('a stepped term shows both years', () => {
    renderWithProviders(
      <PriceSchedule schedule={schedule({ offerKey: 'malva-offer-phone-unlimited', sku: 'MLV-PHN-UNL-24M', standing: usd(5000), monthToMonth: usd(5500), oneTimeDueNow: usd(0) })} locale="en-US" />,
    );
    expect(screen.getByText('1-12')).toBeInTheDocument();
    expect(screen.getByText('13-24')).toBeInTheDocument();
    expect(screen.getByText('$55.00')).toBeInTheDocument();
  });

  it('open-ended (month-to-month): the no-contract sentence and no table', () => {
    renderWithProviders(<PriceSchedule schedule={schedule({ termMonths: 0, sku: 'MLV-CBL-500-M2M', standing: usd(6999), oneTimeDueNow: usd(0) })} locale="en-US" />);
    expect(screen.getByText('No contract: you can cancel any time. Price can change; we tell you before it does.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Price locked for your/)).not.toBeInTheDocument();
  });

  it('several lines: a footnote names the number of lines', () => {
    renderWithProviders(<PriceSchedule schedule={schedule({ quantity: 3 })} locale="en-US" />);
    expect(screen.getByText('x 3 lines')).toBeInTheDocument();
  });

  it('de-DE renders German copy, German amounts and a UTC-stable date', () => {
    renderWithProviders(<PriceSchedule schedule={schedule({ standing: eur(5999), monthToMonth: eur(6999), oneTimeDueNow: eur(2500), orderDate: '2026-10-31' })} locale="de-DE" />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { name: 'Ihr Preis, Monat für Monat' })).toBeInTheDocument();
    expect(screen.getByText(/Nach Ihrer Laufzeit von 24 Monaten: 69,99/)).toBeInTheDocument();
    expect(screen.getByText(/31\.10\.2028/)).toBeInTheDocument();
    expect(screen.getByText(/31\.10\.2026/)).toBeInTheDocument();
  });
});
