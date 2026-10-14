// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactNode } from 'react';
import { GarageProvider } from '@/context/GarageProvider';
import { isLookupEnabled } from '@/lib/vehicles';
import { readGarageState } from '@/lib/vehicles/service';

/**
 * Server component for `app/[locale]/[store]/layout.tsx`: reads the shopper's garage once (cookie or customer field), seeds the SWR
 * cache through `GarageProvider` (no empty-selector flash on first paint) and passes the plate/VIN switch to the client.
 * A failed server read does not break the page: the provider starts empty and `useGarage` fetches `/api/garage`.
 */
export async function GarageRoot({ children }: { children: ReactNode }) {
  let fallback;
  try {
    fallback = await readGarageState();
  } catch {
    fallback = undefined;
  }
  return (
    <GarageProvider fallback={fallback} lookupEnabled={isLookupEnabled()}>
      {children}
    </GarageProvider>
  );
}
