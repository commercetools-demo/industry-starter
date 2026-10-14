// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The mock provider: the ONLY plate and VIN provider (owner answer Q-002). No real decoding service, no credentials.
// Fixtures are FICTIONAL; the vehicles exist in the seed's vehicle table (container `mau-vehicles`):
//   plate B-AB 1234 (DE)  -> 2016 Volkswagen Golf 2.0 TDI
//   plate HH-XY 99  (DE)  -> Volkswagen Golf 2016, engine unknown (1.4 TSI or 2.0 TDI): needs-engine
//   plate 7ABC123   (US)  -> 2020 Toyota Camry 2.5
//   VIN WVWZZZAUZGW000001 -> 2016 Volkswagen Golf 2.0 TDI
// Any other well-formed plate or 17 character VIN is not-found. The UI labels every result "Demo lookup".
import type { Vehicle } from '@/lib/types';
import { vehicleLabel } from '@/lib/vehicles/catalog';
import { buildVehicleId, slugPart } from '@/lib/vehicles/id';
import type { LookupResult, PlateCountry, VehicleLookupProvider } from '@/lib/vehicles/provider';

const vehicle = (make: string, model: string, year: number, engine: string): Vehicle => {
  const parts = { make, model, year, engine };
  return { id: buildVehicleId(parts), ...parts, label: vehicleLabel(parts) };
};

const golf2016Diesel = vehicle('Volkswagen', 'Golf', 2016, '2.0 TDI');
const normalize = (plate: string) => plate.toUpperCase().replace(/[\s-]/g, '');

const PLATES: Record<string, { country: PlateCountry; result: LookupResult }> = {
  BAB1234: { country: 'DE', result: { status: 'resolved', vehicle: golf2016Diesel } },
  HHXY99: {
    country: 'DE',
    result: {
      status: 'needs-engine',
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      engines: ['1.4 TSI', '2.0 TDI'].map((label) => ({ key: slugPart(label), label })),
    },
  },
  '7ABC123': { country: 'US', result: { status: 'resolved', vehicle: vehicle('Toyota', 'Camry', 2020, '2.5') } },
};

const VINS: Record<string, LookupResult> = {
  WVWZZZAUZGW000001: { status: 'resolved', vehicle: golf2016Diesel },
};

export const stubProvider: VehicleLookupProvider = {
  id: 'stub',
  async lookupPlate({ plate, country }) {
    const hit = PLATES[normalize(plate)];
    return hit && hit.country === country ? hit.result : { status: 'not-found' };
  },
  async lookupVin({ vin }) {
    return VINS[vin.toUpperCase()] ?? { status: 'not-found' };
  },
};
