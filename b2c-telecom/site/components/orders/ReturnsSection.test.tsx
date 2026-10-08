import { screen, within } from '@testing-library/react';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { mapOrder } from '@/lib/mappers/order';
import { orderDevice } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import { ReturnsSection } from './ReturnsSection';

const SHIPMENT = ['Advised', 'Returned', 'BackInStock', 'Unusable'] as const;
const PAYMENT = ['NonRefundable', 'Initial', 'Refunded', 'NotRefunded'] as const;
const GOODS_TEXT = { Advised: 'Return requested', Returned: 'Received', BackInStock: 'Received, back in stock', Unusable: 'Received, not resellable' };
const REFUND_TEXT = { NonRefundable: 'Not due yet', Initial: 'Refund pending', Refunded: 'Refunded', NotRefunded: 'Not refunded' };

const withReturns = (items: { shipmentState: string; paymentState: string }[]): CtOrder =>
  ({
    ...orderDevice(),
    returnInfo: [{ returnDate: '2026-05-03T10:00:00.000Z', items: items.map((item, index) => ({ id: `ri-${index}`, type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, ...item })) }],
  }) as unknown as CtOrder;
const view = (ct: CtOrder, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<ReturnsSection order={mapOrder(ct, locale)} />, { locale });
const lineText = (item: HTMLElement, label: string): string => within(item).getByText(`${label}:`).parentElement?.textContent ?? '';

describe('ReturnsSection', () => {
  it('Refund state visible: refund is shown distinctly from whether the goods were received', () => {
    view(withReturns([{ shipmentState: 'Returned', paymentState: 'Refunded' }]));
    const item = screen.getByTestId('return-item');
    expect(within(item).getByText('1 × Nova Pro')).toBeInTheDocument();
    expect(lineText(item, 'Goods')).toBe('Goods:Received');
    expect(lineText(item, 'Refund')).toBe('Refund:Refunded');
  });

  it.each(SHIPMENT.flatMap((goods) => PAYMENT.map((refund) => [goods, refund] as const)))('renders goods %s and refund %s as two separate lines', (goods, refund) => {
    view(withReturns([{ shipmentState: goods, paymentState: refund }]));
    const item = screen.getByTestId('return-item');
    expect(lineText(item, 'Goods')).toBe(`Goods:${GOODS_TEXT[goods]}`);
    expect(lineText(item, 'Refund')).toBe(`Refund:${REFUND_TEXT[refund]}`);
  });

  it('shows an unknown platform value as it is, in muted text', () => {
    view(withReturns([{ shipmentState: 'Teleported', paymentState: 'Mystery' }]));
    const item = screen.getByTestId('return-item');
    expect(within(item).getByText('Teleported')).toHaveClass('text-text-muted');
    expect(within(item).getByText('Mystery')).toHaveClass('text-text-muted');
  });

  it('lists every item of a request and its date', () => {
    view(withReturns([{ shipmentState: 'Advised', paymentState: 'NonRefundable' }, { shipmentState: 'Returned', paymentState: 'Initial' }]));
    expect(screen.getByRole('heading', { level: 2, name: 'Returns' })).toBeInTheDocument();
    expect(screen.getByText('Requested May 3, 2026')).toBeInTheDocument();
    expect(screen.getAllByTestId('return-item')).toHaveLength(2);
  });

  it('is hidden when there are no returns', () => {
    view(orderDevice());
    expect(screen.queryByRole('heading', { name: 'Returns' })).not.toBeInTheDocument();
  });

  it('is translated to German', () => {
    view(withReturns([{ shipmentState: 'BackInStock', paymentState: 'Initial' }]), 'de-DE');
    const item = screen.getByTestId('return-item');
    expect(screen.getByRole('heading', { level: 2, name: 'Rückgaben' })).toBeInTheDocument();
    expect(lineText(item, 'Ware')).toBe('Ware:Eingegangen, wieder auf Lager');
    expect(lineText(item, 'Erstattung')).toBe('Erstattung:Erstattung ausstehend');
  });
});
