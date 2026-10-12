// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Provider selection and the plate/VIN switch. Reads only non-secret variables, so it needs no `server-only`.
//   VEHICLE_PROVIDER=stub              the mock provider, the only one (Q-002)
//   VEHICLE_LOOKUP_ENABLED=true|false  shows the Plate and VIN tabs (default: on outside production, off in production)
//   VEHICLE_MOCK_ACKNOWLEDGED=true     demo opt-in the production build needs to show mock lookups (scripts/check-vehicle-provider.mjs)
import type { VehicleLookupProvider } from './provider';
import { stubProvider } from './providers/stub';

type Env = Record<string, string | undefined>;

const PROVIDERS: Record<string, VehicleLookupProvider> = { stub: stubProvider };

/** The configured provider; an unknown `VEHICLE_PROVIDER` throws (only `stub` exists). */
export function getProvider(env: Env = process.env): VehicleLookupProvider {
  const id = env.VEHICLE_PROVIDER?.trim() || 'stub';
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown VEHICLE_PROVIDER "${id}": only ${Object.keys(PROVIDERS).join(', ')} exists`);
  return provider;
}

export function isLookupEnabled(env: Env = process.env): boolean {
  const flag = env.VEHICLE_LOOKUP_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}
