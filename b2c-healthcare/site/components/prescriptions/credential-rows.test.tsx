import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { CartLine, RxLineView } from '@/lib/types';

vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import { CartLineRow } from '@/components/cart/CartLineRow';
import { MedicationRow } from './MedicationRow';

const row = (over: Partial<RxLineView> = {}): RxLineView => ({
  lineRef: 'RX-1-2', name: 'Tramadol 50 mg tablets', sig: '1 tablet every 12 h as needed', qty: 30, price: { centAmount: 1310, currencyCode: 'USD', fractionDigits: 2 },
  status: 'CREDENTIAL', selectable: false, minShelfLifeMonths: null, controlClass: 'schedule-iv', credential: 'NONE', ...over,
});

function renderRow(line: RxLineView) {
  renderWithProviders(
    <ul>
      <MedicationRow line={line} checked={false} onChange={() => undefined} />
    </ul>,
  );
  return screen.getByRole('checkbox', { name: /Tramadol/ });
}

describe('credentialed-purchase-scope: controlled goods are shown but unavailable, with the requirement stated', () => {
  it.each([
    ['NONE', 'Requires a valid Schedule IV credential. You have none on file.'],
    ['WRONG_SCOPE', 'Your credential does not cover Schedule IV. A valid Schedule IV credential is required.'],
    ['EXPIRED', 'Your Schedule IV credential has expired.'],
    ['PENDING', 'Your Schedule IV credential is awaiting verification. You can buy this once it is verified.'],
  ] as const)('prescription row, %s: visible, disabled, and says why', (credential, text) => {
    const box = renderRow(row({ credential }));
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription(expect.stringContaining(text));
  });

  it('verification pending reads as outstanding, not as ineligible', () => {
    renderRow(row({ credential: 'PENDING' }));
    expect(screen.getByText(/awaiting verification/)).toBeInTheDocument();
    expect(screen.queryByText(/not eligible|ineligible/i)).toBeNull();
  });

  it('a controlled row the patient may buy is an ordinary selectable row', () => {
    const box = renderRow(row({ status: 'ok', selectable: true, credential: undefined }));
    expect(box).toBeEnabled();
  });

  it('the cart says why a controlled line cannot go on, naming the class', () => {
    const line: CartLine = {
      id: 'l1', sku: 'MED-tramadol-50-mg', name: { 'en-US': 'Tramadol 50 mg tablets' }, rxNumber: 'RX-1', rxLineRef: 'RX-1-2', prescribedQty: 30,
      unitPrice: { centAmount: 1310, currencyCode: 'USD', fractionDigits: 2 }, totalPrice: { centAmount: 1310, currencyCode: 'USD', fractionDigits: 2 }, priceUpdated: false,
      unavailable: { reason: 'CREDENTIAL', credential: 'EXPIRED', credentialClass: 'schedule-iv' },
    };
    renderWithProviders(
      <ul>
        <CartLineRow line={line} busy={false} onRemove={() => undefined} />
      </ul>,
    );
    expect(screen.getByText('Your Schedule IV credential has expired.')).toHaveAttribute('data-unavailable', 'CREDENTIAL');
  });
});
