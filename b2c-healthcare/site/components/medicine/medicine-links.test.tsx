import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { CartLineRow } from '@/components/cart/CartLineRow';
import { ListDetail } from '@/components/lists/ListDetail';
import { OrderList } from '@/components/orders/OrderList';
import { MedicationRow } from '@/components/prescriptions/MedicationRow';
import { MedicineResult } from '@/components/search/MedicineResult';
import type { CartLine, Medication, RxLineView } from '@/lib/types';
import type { OrderView } from '@/lib/order-types';
import type { ListView } from '@/lib/lists-types';

vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

const money =(centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const HREF = '/en-US/medicine/mlv-med-atorvastatin-20-mg';
const SKU = 'MED-atorvastatin-20-mg';

describe('product-detail-page: medicines are linked wherever they appear', () => {
  it('search hit: the name links to the medicine page by product key', () => {
    const medicine: Medication = {
      id: 'p', key: 'mlv-med-atorvastatin-20-mg', slug: 'a', name: 'Atorvastatin 20 mg tablets', description: '', sku: SKU, strength: '20 mg', dosageForm: 'Tablet', rxOnly: true,
      dispenseUnit: 'pack', minRemainingShelfLifeDays: 90, maxQtyPerOrder: 3, hsaEligible: true, controlClass: null, price: money(1875), imageUrl: null, categoryIds: [],
    };
    renderWithProviders(<MedicineResult medicine={medicine} />);
    expect(screen.getByRole('link', { name: 'Atorvastatin 20 mg tablets' })).toHaveAttribute('href', HREF);
  });

  it('prescription row: the name links, the checkbox label still names the row', () => {
    const line: RxLineView = { sku: SKU, lineRef: 'l1', name: 'Atorvastatin 20 mg', sig: 'Once daily', qty: 30, price: money(1875), status: 'ok', selectable: true, minShelfLifeMonths: null };
    renderWithProviders(
      <ul>
        <MedicationRow line={line} checked={false} onChange={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole('link', { name: 'Atorvastatin 20 mg' })).toHaveAttribute('href', HREF);
  });

  it('prescription row without a SKU stays plain text', () => {
    const line: RxLineView = { lineRef: 'l1', name: 'Atorvastatin 20 mg', sig: 'Once daily', qty: 30, price: money(1875), status: 'ok', selectable: true, minShelfLifeMonths: null };
    renderWithProviders(
      <ul>
        <MedicationRow line={line} checked={false} onChange={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('cart row: the name links', () => {
    const line: CartLine = {
      id: 'c1', sku: SKU, name: { 'en-US': 'Atorvastatin 20 mg' }, rxNumber: 'RX-1', rxLineRef: 'r', prescribedQty: 30, unitPrice: money(1875), totalPrice: money(1875), priceUpdated: false,
    };
    renderWithProviders(
      <ul>
        <CartLineRow line={line} busy={false} onRemove={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole('link', { name: 'Atorvastatin 20 mg' })).toHaveAttribute('href', HREF);
  });

  it('saved list line: the name links', () => {
    const list: ListView = {
      id: 'a', name: 'Monthly', lineCount: 1, updatedAt: '2026-10-08T10:00:00Z',
      lines: [{ id: '1', name: 'Atorvastatin 20 mg', sku: SKU, price: money(1875), savedPrice: null, priceDeltaCents: null, unavailable: false }],
    };
    renderWithProviders(<ListDetail list={list} />);
    expect(screen.getByRole('link', { name: 'Atorvastatin 20 mg' })).toHaveAttribute('href', HREF);
  });

  it('order card: medication names link and the list stays name-only for lines without a SKU', () => {
    const order: OrderView = {
      id: 'o1', orderNumber: 'MLV-000042', status: 'received', shipmentState: null, createdAt: '2026-10-08T10:00:00Z',
      lines: [{ name: 'Atorvastatin 20 mg', quantity: 1, sku: SKU }, { name: 'Old product', quantity: 1 }],
      deliverTo: null, sameDay: false, total: money(1875), refund: 'none', cancellable: true,
    };
    renderWithProviders(<OrderList orders={[order]} />);
    expect(screen.getByRole('link', { name: 'Atorvastatin 20 mg' })).toHaveAttribute('href', HREF);
    expect(screen.getByText(/Old product/).closest('a')).toBeNull();
  });
});
