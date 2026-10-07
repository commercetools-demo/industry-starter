import { screen } from '@testing-library/react';
import { mapOrder } from '@/lib/mappers/order';
import { ctLine, ctOrder, kindAttrs, orderA, orderDevice, NOVA_SKU } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { OrderTotals } from './OrderTotals';

const device = (id: string, mode: string, total: number, recurring: boolean) =>
  ctLine({ id, productKey: 'malva-offer-phone-nova-pro', sku: `${NOVA_SKU}${id}`, name: 'Nova Pro', total, recurring: recurring ? 'Fixed' : null, attributes: kindAttrs('device', 'phone'), fields: { acquisitionMode: mode, acquisitionTermMonths: 24 } });

describe('OrderTotals', () => {
  it('shows what is due at order and the monthly amount after that', () => {
    renderWithProviders(<OrderTotals order={mapOrder(orderA(), 'en-US')} />);
    expect(screen.getByText('Due at order').nextSibling).toHaveTextContent('$69.98');
    expect(screen.getByText('Monthly after that').nextSibling).toHaveTextContent('$69.98/mo');
  });

  it('shows no per-mode lines for one acquisition mode', () => {
    renderWithProviders(<OrderTotals order={mapOrder(orderDevice(), 'en-US')} />);
    expect(screen.queryByText(/Installments \$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pay in full \$/)).not.toBeInTheDocument();
  });

  it('shows one line per acquisition mode when the order mixes modes', () => {
    const mixed = ctOrder({ orderNumber: 'QA-MIX', total: 50000, lines: [device('a', 'outright', 99900, false), device('b', 'installments', 4200, true), device('c', 'lease', 3000, true)] });
    renderWithProviders(<OrderTotals order={mapOrder(mixed, 'en-US')} />);
    expect(screen.getByText('Pay in full $999.00')).toBeInTheDocument();
    expect(screen.getByText('Installments $42.00/mo')).toBeInTheDocument();
    expect(screen.getByText('Lease $30.00/mo')).toBeInTheDocument();
  });
});
