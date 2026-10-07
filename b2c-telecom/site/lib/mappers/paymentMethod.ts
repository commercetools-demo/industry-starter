import 'server-only';
import type { PaymentMethod } from '@commercetools/platform-sdk';
import type { CardBrand, PaymentMethodView } from '@/lib/types';

const BRANDS: readonly CardBrand[] = ['visa', 'mastercard', 'amex'];

const field = (pm: PaymentMethod, name: string): unknown => (pm.custom?.fields as Record<string, unknown> | undefined)?.[name];

function brandOf(pm: PaymentMethod): CardBrand {
  const raw = field(pm, 'brand');
  const key = typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null && 'key' in raw ? String((raw as { key: unknown }).key) : '';
  return BRANDS.find((brand) => brand === key) ?? 'unknown';
}

function expiryOf(pm: PaymentMethod): string | null {
  const month = field(pm, 'expMonth');
  const year = field(pm, 'expYear');
  if (typeof month !== 'number' || typeof year !== 'number' || month < 1 || month > 12) return null;
  return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
}

/**
 * A stored payment method -> what the buyer may see (D-032: a non-sensitive descriptor and the default flag). Built field by field:
 * the token, the payment interface and the interface account are never copied, so no later change to the record can leak them.
 * `label` is the localized record name; the card sentence ("Visa ending 4242", "Saved card") is built by the UI from brand and last4.
 */
export function mapPaymentMethod(pm: PaymentMethod, locale: string): PaymentMethodView {
  const last4 = field(pm, 'last4');
  return {
    id: pm.id,
    brand: brandOf(pm),
    last4: typeof last4 === 'string' && /^\d{4}$/.test(last4) ? last4 : null,
    expiry: expiryOf(pm),
    label: pm.name?.[locale] ?? pm.name?.['en-US'] ?? '',
    isDefault: pm.default,
  };
}
