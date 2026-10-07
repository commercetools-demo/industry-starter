import { screen, within } from '@testing-library/react';
import { mapOrder } from '@/lib/mappers/order';
import { ctLine, ctOrder, kindAttrs, orderA, orderDevice, NOVA_SKU } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { OrderLines } from './OrderLines';

const rowOf = (name: RegExp) => within(screen.getByRole('row', { name }));

describe('OrderLines', () => {
  it('lists name, type, quantity, unit price and total, with /mo on recurring lines', () => {
    renderWithProviders(<OrderLines order={mapOrder(orderA(), 'en-US')} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Item', 'Type', 'Qty', 'Unit price', 'Total']);
    const cable = rowOf(/^Cable 500/);
    expect(cable.getByText('Cable internet')).toBeInTheDocument();
    expect(cable.getAllByText('$59.99/mo')).toHaveLength(2);
  });

  it('shows the plan an add-on belongs to', () => {
    renderWithProviders(<OrderLines order={mapOrder(orderA(), 'en-US')} />);
    expect(rowOf(/Apple TV\+/).getByText('Part of Cable 500')).toBeInTheDocument();
  });

  it('a handset on installments shows memory, colour, the mode and the final payment date', () => {
    renderWithProviders(<OrderLines order={mapOrder(orderDevice(), 'en-US')} />);
    const device = rowOf(/Nova Pro 256 GB, Black/);
    expect(device.getByText('Installments, 24 months · Final payment Apr 2, 2028')).toBeInTheDocument();
    expect(device.getByText('Device installments')).toBeInTheDocument();
  });

  it('a leased handset shows the return-by date; an outright one only "Pay in full"', () => {
    const lease = ctOrder({
      orderNumber: 'QA-L',
      total: 1,
      lines: [
        ctLine({ id: 'l1', productKey: 'malva-offer-phone-nova-5g', sku: 'MLV-DEV-NOVA5G-BLK-128', name: 'Nova 5G', total: 3000, recurring: 'Fixed', attributes: kindAttrs('device', 'phone'), fields: { acquisitionMode: 'lease', acquisitionTermMonths: 24 } }),
        ctLine({ id: 'l2', productKey: 'malva-offer-phone-nova-pro', sku: NOVA_SKU, name: 'Nova Pro', total: 99900, attributes: kindAttrs('device', 'phone'), fields: { acquisitionMode: 'outright' } }),
      ],
      fields: { serviceStartDate: '2026-05-02' },
    });
    renderWithProviders(<OrderLines order={mapOrder(lease, 'en-US')} />);
    expect(rowOf(/Nova 5G 128 GB, Black/).getByText('Lease, 24 months · Return by May 2, 2028')).toBeInTheDocument();
    expect(rowOf(/Nova Pro 256 GB, Black/).getByText('Pay in full')).toBeInTheDocument();
  });
});
