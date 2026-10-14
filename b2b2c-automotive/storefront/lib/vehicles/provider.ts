// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Plate and VIN lookup provider interface (owner answer Q-002: the mock provider is the only provider; no real decoding service).
import type { Vehicle } from '@/lib/types';

export type PlateCountry = 'DE' | 'AT' | 'CH' | 'US';
export const PLATE_COUNTRIES: readonly PlateCountry[] = ['DE', 'AT', 'CH', 'US'];

export type LookupResult =
  | { status: 'resolved'; vehicle: Vehicle }
  | { status: 'needs-engine'; make: string; model: string; year: number; engines: Array<{ key: string; label: string }> }
  | { status: 'not-found' }
  | { status: 'invalid'; reason: 'plate-format' | 'vin-length' | 'vin-characters' }
  | { status: 'unavailable' };

export interface VehicleLookupProvider {
  /** `'stub'` is the mock. */
  readonly id: string;
  lookupPlate(input: { plate: string; country: PlateCountry }): Promise<LookupResult>;
  lookupVin(input: { vin: string }): Promise<LookupResult>;
}
