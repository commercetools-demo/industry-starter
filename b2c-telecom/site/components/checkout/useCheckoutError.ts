'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CheckoutError } from '@/hooks/useCheckout';

/** The buyer-facing sentence for a failed checkout request: `checkout.error.<code>` when it exists, else the generic one. */
export function useCheckoutErrorText(): (error: unknown) => string {
  const t = useTranslations('checkout.error');
  return useCallback(
    (error: unknown): string => {
      const code = error instanceof CheckoutError ? error.code : 'generic';
      return t.has(code) ? t(code) : t('generic');
    },
    [t],
  );
}
