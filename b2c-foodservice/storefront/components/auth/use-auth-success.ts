'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useToast } from '@/context/toast';
import type { AuthResult } from '@/hooks/useAuthActions';
import { useCartCount } from '@/hooks/useCartCount';
import { useRouter } from '@/i18n/routing';

/**
 * What every successful sign-in, demo sign-in and registration does next: a toast, then `router.replace(redirectTo)`.
 * The "bag was added" toast shows only when the guest had a bag and the merged bag holds more units than it did.
 */
export function useAuthSuccess(redirectTo: string) {
  const t = useTranslations('auth');
  const toast = useToast();
  const router = useRouter();
  const guestUnits = useCartCount();
  return useCallback(
    (result: AuthResult, kind: 'signIn' | 'register' = 'signIn') => {
      if (kind === 'register') toast.show(t('register.created'));
      else if (guestUnits > 0 && (result.cart?.quantity ?? 0) > guestUnits) toast.show(t('signIn.cartMerged'));
      router.replace(redirectTo);
    },
    [guestUnits, redirectTo, router, t, toast],
  );
}
