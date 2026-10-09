import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { OrderConfirmation } from './OrderConfirmation';
import { OrderOutcomeUnknown } from './OrderOutcomeUnknown';

// The locale layout provides the one <main id="main">; a second landmark inside it is an accessibility defect (found by the Z sweep).
describe('order pages do not render their own <main> landmark', () => {
  it('OrderConfirmation', () => {
    renderWithProviders(
      <OrderConfirmation order={{ id: 'o1', orderNumber: 'MLV-000042', status: 'received', shipmentState: null, createdAt: '2026-10-08T10:00:00Z', lines: [{ name: 'A', quantity: 1 }], sameDay: false, total: { centAmount: 100, currencyCode: 'USD', fractionDigits: 2 }, refund: 'none', cancellable: false }} />,
    );
    expect(screen.queryByRole('main')).toBeNull();
  });
  it('OrderOutcomeUnknown', () => {
    renderWithProviders(<OrderOutcomeUnknown />);
    expect(screen.queryByRole('main')).toBeNull();
  });
});
