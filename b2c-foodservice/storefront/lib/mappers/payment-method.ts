import type { PaymentMethod } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';
import type { PaymentMethodView } from '@/lib/types';

/**
 * A stored payment method for the shopper. Only what a person needs: an id, a version, a label, the method key and the
 * default flag. The token (`token.value`), the payment interface and the interface account NEVER leave the server.
 * `label` is the localized name when the connector fills one, else empty and the client shows the translated method.
 */
export function toPaymentMethodView(m: PaymentMethod, locale: string): PaymentMethodView {
  return {
    id: m.id,
    version: m.version,
    label: m.name ? getLocalizedString(m.name as Record<string, string>, locale) : '',
    method: m.method ?? '',
    isDefault: m.default,
  };
}
