import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';
import type { OrderView } from '@/lib/order-types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import { OrderConfirmation } from './OrderConfirmation';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const order = (over: Partial<OrderView> = {}): OrderView => ({
  id: 'o1', orderNumber: 'MLV-000001', status: 'received', shipmentState: null, createdAt: '2026-10-08T12:00:00Z',
  lines: [{ name: 'Atorvastatin 20 mg' , quantity: 1 }, { name: 'Alprazolam 0.5 mg', quantity: 1 }],
  deliverTo: null, sameDay: false, total: usd(3135), refund: 'none', cancellable: false, ...over,
});

describe('eligible-item-tender-restriction: Eligibility visible on the order (U-09)', () => {
  it('a mixed order says per line whether it qualified and which instrument settled it', () => {
    renderWithProviders(
      <OrderConfirmation
        order={order({
          lines: [
            { name: 'Atorvastatin 20 mg', quantity: 1, eligible: true, settledBy: ['restricted-health-account'] },
            { name: 'Alprazolam 0.5 mg', quantity: 1, eligible: false, settledBy: ['card'] },
          ],
          tender: { allowance: usd(0), restricted: usd(1875), card: usd(1260) },
        })}
      />,
    );
    const lines = document.querySelector('[data-order-lines]') as HTMLElement;
    const [a, b] = within(lines).getAllByRole('listitem');
    expect(a).toHaveTextContent('Atorvastatin 20 mg: Qualifying for the health account card · Paid with Health account card (demo)');
    expect(a).toHaveAttribute('data-eligible', 'true');
    expect(b).toHaveTextContent('Alprazolam 0.5 mg: Not qualifying for the health account card · Paid with card');
    expect(document.querySelector('[data-tender-restricted]')).toHaveTextContent('$18.75');
    expect(document.querySelector('[data-tender-card]')).toHaveTextContent('$12.60');
  });

  it('an order the allowance covered says no card payment and states the new balance', () => {
    renderWithProviders(<OrderConfirmation order={order({ tender: { allowance: usd(3135), restricted: usd(0), card: usd(0) } })} allowanceBalance={usd(1865)} />);
    expect(document.querySelector('[data-tender-allowance]')).toHaveTextContent('$31.35');
    expect(document.querySelector('[data-tender-card]')).toHaveTextContent('No card payment');
    expect(document.querySelector('[data-allowance-balance]')).toHaveTextContent('$18.65');
  });

  it('an ordinary card order shows no tender section', () => {
    renderWithProviders(<OrderConfirmation order={order()} />);
    expect(screen.queryByText('How this order was paid')).toBeNull();
  });
});
