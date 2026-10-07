'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MAX_DEVICE_QUANTITY } from '@/lib/config/devices';
import { CartError } from '@/hooks/useCart';
import type { AcquisitionMode } from '@/lib/types';

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];
const asMode = (value: unknown): AcquisitionMode | undefined => MODES.find((mode) => mode === value);

/**
 * The text of a refused device request, in the buyer's language, from the stable code and details of the route: the server's English
 * message is never shown. Unknown codes and network failures read as the generic bundle error.
 */
export function useDeviceErrorText(deviceName: string): (error: unknown) => string {
  const t = useTranslations('devices');
  const tb = useTranslations('bundle');
  return useCallback(
    (error: unknown): string => {
      if (!(error instanceof CartError)) return tb('error.generic');
      const details = error.details ?? {};
      switch (error.bundleCode) {
        case 'MODE_UNAVAILABLE': {
          const mode = asMode(details.mode);
          const available = Array.isArray(details.available) ? details.available.flatMap((entry) => (asMode(entry) ? [t(`mode.${entry as AcquisitionMode}`)] : [])) : [];
          return mode ? t('unavailable', { mode: t(`mode.${mode}`), device: deviceName, modes: available.join(', ') }) : tb('error.generic');
        }
        case 'TERM_UNAVAILABLE':
          return typeof details.termMonths === 'number' ? t('termUnavailable', { months: details.termMonths }) : tb('error.generic');
        case 'PRICE_NOT_FOR_TERM':
          return t('priceNotForTerm');
        case 'INSUFFICIENT_STOCK':
          return typeof details.available === 'number' && details.available > 0 ? tb('blocked.stock', { available: details.available, name: deviceName }) : tb('blocked.outOfStock', { name: deviceName });
        case 'OFFER_BLOCKED':
          return details.kind === 'limit' ? t('limit', { max: MAX_DEVICE_QUANTITY }) : tb('blocked.generic');
        default:
          return tb('error.generic');
      }
    },
    [deviceName, t, tb],
  );
}
