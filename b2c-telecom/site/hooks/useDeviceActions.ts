'use client';

import { useMemo } from 'react';
import { useCartRequest } from '@/hooks/useCart';
import type { AcquisitionMode, AddDeviceArgs, Cart } from '@/lib/types';

export interface DeviceActions {
  /** Adds a handset in a mode and term. Rejects with a `CartError` (code MODE_UNAVAILABLE, TERM_UNAVAILABLE, PRICE_NOT_FOR_TERM ...). */
  addDeviceLine: (args: AddDeviceArgs) => Promise<Cart | null>;
  /** Changes how a device line of the bundle is paid: the server removes and re-adds the line and answers the repriced cart. */
  changeAcquisition: (lineId: string, next: { mode: AcquisitionMode; termMonths: number }) => Promise<Cart | null>;
}

/** The device routes of the bundle. The cart of every answer (also of a refusal) is written into the cart cache, never computed here. */
export function useDeviceActions(): DeviceActions {
  const send = useCartRequest();
  return useMemo<DeviceActions>(
    () => ({
      addDeviceLine: (args) => send('/api/cart/devices', 'POST', args),
      changeAcquisition: (lineId, next) => send(`/api/cart/devices/${encodeURIComponent(lineId)}`, 'PATCH', { mode: next.mode, termMonths: next.termMonths }),
    }),
    [send],
  );
}
