// Mapped `Cart` objects for component tests (what GET /api/cart answers).
import { SAMPLE_LABEL } from '@/components/label/__fixtures__/label';
import type { Cart, CartLine, CartSummary, Money, PriceSchedule } from '@/lib/types';

export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

export const SCHEDULE: PriceSchedule = {
  v: 1,
  offerKey: 'malva-offer-cable-500',
  sku: 'MLV-CBL-500-24M',
  termMonths: 24,
  quantity: 1,
  currencyCode: 'USD',
  priceMode: 'Fixed',
  orderDate: '2026-10-07',
  periods: [{ index: 1, fromMonth: 1, toMonth: 24, months: 24, startsOn: '2026-10-07', endsOn: '2028-10-06', monthlyAmount: usd(5999), kind: 'standing' }],
  openEnded: false,
  totalContractValue: usd(143976),
  dueAtOrder: usd(8499),
  afterTerm: { startsOn: '2028-10-07', monthlyAmount: usd(6999), basis: 'month-to-month-price' },
  introEndsOn: null,
  status: 'active',
};

export function planLine(patch: Partial<CartLine> = {}): CartLine {
  return {
    id: 'L1',
    source: 'line-item',
    offerKey: 'malva-offer-cable-500',
    sku: 'MLV-CBL-500-24M',
    kind: 'plan',
    name: 'Cable 500',
    family: 'internet',
    technology: 'cable',
    bullets: ['Up to 500 Mbps', 'Unlimited data', 'Free modem'],
    description: '',
    quantity: 1,
    termMonths: 24,
    chargeType: 'recurring',
    recurrence: { policyKey: 'malva-monthly', priceSelectionMode: 'Fixed' },
    unitListPrice: usd(5999),
    unitPrice: usd(5999),
    total: usd(5999),
    appliedDiscountKeys: [],
    parentLineId: null,
    includedAtNoCharge: false,
    requiredEquipment: false,
    schedule: SCHEDULE,
    label: SAMPLE_LABEL,
    stock: null,
    ...patch,
  };
}

export function phoneLine(patch: Partial<CartLine> = {}): CartLine {
  return planLine({
    id: 'P1',
    offerKey: 'malva-offer-phone-unlimited',
    sku: 'MLV-PHN-UNL-M2M',
    name: 'Unlimited',
    family: 'phone',
    technology: 'mobile',
    bullets: ['Unlimited talk, text and data'],
    termMonths: 0,
    recurrence: { policyKey: 'malva-monthly', priceSelectionMode: 'Dynamic' },
    unitListPrice: usd(5500),
    unitPrice: usd(5500),
    total: usd(5500),
    schedule: null,
    label: { ...SAMPLE_LABEL, id: 'MLV-PHN-UNL-M2M', planName: 'Unlimited', kind: 'Phone plan' },
    ...patch,
  });
}

export function addonLine(patch: Partial<CartLine> = {}): CartLine {
  return planLine({
    id: 'A1',
    offerKey: 'malva-offer-appletv',
    sku: 'MLV-ADD-APPLETV-MTH',
    kind: 'addon',
    name: 'Apple TV+',
    description: 'Streaming included',
    bullets: [],
    termMonths: 0,
    recurrence: { policyKey: 'malva-monthly', priceSelectionMode: 'Dynamic' },
    unitListPrice: usd(999),
    unitPrice: usd(999),
    total: usd(999),
    parentLineId: 'L1',
    schedule: null,
    label: null,
    ...patch,
  });
}

export function feeLine(patch: Partial<CartLine> = {}): CartLine {
  return planLine({
    id: 'F1',
    source: 'custom-line-item',
    kind: 'fee',
    sku: null,
    name: 'Activation fee',
    chargeType: 'one-time',
    recurrence: null,
    unitListPrice: usd(2500),
    unitPrice: usd(2500),
    total: usd(2500),
    parentLineId: 'L1',
    schedule: null,
    label: null,
    family: null,
    technology: null,
    bullets: [],
    ...patch,
  });
}

export function makeCart(patch: Omit<Partial<Cart>, 'summary'> & { summary?: Partial<CartSummary> } = {}): Cart {
  const lines = patch.lines ?? [planLine(), feeLine()];
  const recurring = lines.filter((line) => line.chargeType === 'recurring');
  const sum = (items: CartLine[]): Money => usd(items.reduce((acc, line) => acc + line.total.centAmount, 0));
  const summary: CartSummary = {
    plans: sum(recurring.filter((line) => line.kind === 'plan')),
    addons: sum(recurring.filter((line) => line.kind === 'addon' || line.kind === 'equipment')),
    devicesMonthly: sum(recurring.filter((line) => line.kind === 'device')),
    monthly: sum(recurring),
    oneTime: sum(lines.filter((line) => line.chargeType === 'one-time')),
    discountTotal: usd(0),
    tax: null,
    total: sum(lines),
    ...patch.summary,
  };
  const { lines: _lines, summary: _summary, ...rest } = patch;
  void _lines;
  void _summary;
  return {
    id: 'cart-1',
    version: 4,
    currencyCode: 'USD',
    country: 'US',
    lines,
    itemCount: lines.filter((line) => line.kind !== 'fee').length,
    summary,
    discountCodes: [],
    minimumOrder: { required: usd(3000), shortfall: summary.total.centAmount < 3000 && lines.length > 0 ? usd(3000 - summary.total.centAmount) : null },
    issues: [],
    canCheckout: true,
    checkoutBlockedBy: [],
    postalCode: null,
    ...rest,
  };
}
