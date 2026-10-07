import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { ContractRow } from '@/lib/types';
import { ContractNote, ContractTable } from './ContractTable';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const rows: ContractRow[] = [
  { key: 'a:1', orderNumber: 'A', sku: 'MLV-CBL-500-24M', name: 'Cable 500', deviceVariant: null, family: 'cable', startedOn: '2026-03-12', termMonths: 24, endsOn: '2028-03-12', monthly: usd(5999) },
  { key: 'b:1', orderNumber: 'B', sku: 'MLV-PHN-UNL-M2M', name: 'Unlimited', deviceVariant: null, family: 'phone', startedOn: '2025-06-03', termMonths: 0, endsOn: null, monthly: usd(5000) },
  { key: 'd:1', orderNumber: 'D', sku: 'MLV-DEV-NOVAPRO-BLK-256', name: 'Nova Pro', deviceVariant: { memoryGb: '256', color: 'black' }, family: 'installments', startedOn: '2026-05-02', termMonths: 24, endsOn: '2028-04-02', monthly: usd(4200) },
];

describe('ContractTable', () => {
  it('has the five column headers with scope and a row per service', () => {
    renderWithProviders(<ContractTable rows={rows} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Item', 'Type', 'Started', 'Term', 'Price']);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('prints the design rows: type, start date, term and price per month', () => {
    renderWithProviders(<ContractTable rows={rows} />);
    const cable = within(screen.getByRole('row', { name: /Cable 500/ }));
    expect(cable.getByText('Cable internet')).toBeInTheDocument();
    expect(cable.getByText('Mar 12, 2026')).toBeInTheDocument();
    expect(cable.getByText('24 months · ends Mar 12, 2028')).toBeInTheDocument();
    expect(cable.getByText('$59.99/mo')).toBeInTheDocument();
    const phone = within(screen.getByRole('row', { name: /Unlimited/ }));
    expect(phone.getByText('Month-to-month')).toBeInTheDocument();
    expect(phone.getByText('Phone plan')).toBeInTheDocument();
  });

  it('names a handset with memory and colour and shows its installment end date', () => {
    renderWithProviders(<ContractTable rows={rows} />);
    const device = within(screen.getByRole('row', { name: /Nova Pro 256 GB, Black/ }));
    expect(device.getByText('Device installments')).toBeInTheDocument();
    expect(device.getByText('24 months · ends Apr 2, 2028')).toBeInTheDocument();
    expect(device.getByText('$42.00/mo')).toBeInTheDocument();
  });

  it('right-aligns the price column and scrolls inside its own frame', () => {
    renderWithProviders(<ContractTable rows={rows} />);
    expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveClass('text-right');
    expect(screen.getByText('$59.99/mo')).toHaveClass('text-right');
    const frame = screen.getByRole('region', { name: 'Current contract' });
    expect(frame).toHaveClass('overflow-x-auto');
    expect(within(frame).getByRole('table')).toHaveClass('min-w-160');
  });

  it('shows the early-termination footnote', () => {
    renderWithProviders(<ContractNote />);
    expect(screen.getByText("The early-termination fee is shown on each plan's Broadband Facts label.")).toBeInTheDocument();
  });

  it('formats dates and the term in German', () => {
    renderWithProviders(<ContractTable rows={rows} />, { locale: 'de-DE' });
    expect(screen.getByText('24 Monate · endet am 12.03.2028')).toBeInTheDocument();
    expect(screen.getByText('Monatlich kündbar')).toBeInTheDocument();
  });
});
