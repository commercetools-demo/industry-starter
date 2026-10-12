// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { useRouter } from '@/i18n/routing';
import { KEY_GARAGE } from '@/lib/cache-keys';
import type { GarageState } from '@/lib/types';

export interface GarageContextValue {
  /** Show the Plate and VIN tabs (server decision, `VEHICLE_LOOKUP_ENABLED`). */
  lookupEnabled: boolean;
  /** Called after the garage changed, so server-rendered pages (listings, product pages) re-read the active vehicle. */
  onChange?: () => void;
}

export const GarageContext = createContext<GarageContextValue>({ lookupEnabled: false });

interface GarageProviderProps {
  /** The garage read on the server, so the first paint has no empty-selector flash. */
  fallback?: GarageState;
  lookupEnabled?: boolean;
  children: ReactNode;
}

/**
 * Seeds the SWR cache with the server-read garage and tells `useGarage` how to refresh server components after a change
 * (`router.refresh()`). Mount once in `app/[locale]/[store]/layout.tsx` through `GarageRoot` (components/vehicle/GarageRoot.tsx).
 */
export function GarageProvider({ fallback, lookupEnabled = false, children }: GarageProviderProps) {
  const router = useRouter();
  const refresh = router.refresh;
  const onChange = useCallback(() => refresh(), [refresh]);
  const value = useMemo(() => ({ lookupEnabled, onChange }), [lookupEnabled, onChange]);
  return (
    <SWRConfig value={{ fallback: fallback ? { [KEY_GARAGE]: fallback } : {} }}>
      <GarageContext.Provider value={value}>{children}</GarageContext.Provider>
    </SWRConfig>
  );
}
