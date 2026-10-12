// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Test fixture only: the 26 records of the seed's vehicle table (copied from seed/src/data/vehicles.ts, synthetic demo data).
import type { VehicleRecord } from '@/lib/types';

type Def = [make: string, model: string, generation: string, from: number, to: number, engines: string[], markets: string[]];

const DEFS: Def[] = [
  ['Volkswagen', 'Golf', 'VII', 2012, 2019, ['1.4 TSI', '2.0 TDI'], ['DE']],
  ['Volkswagen', 'Golf', 'VIII', 2019, 2024, ['1.5 TSI', '2.0 TDI'], ['DE']],
  ['Audi', 'A3', '8V', 2012, 2020, ['1.4 TFSI', '2.0 TDI'], ['DE']],
  ['BMW', '3 Series', 'F30', 2012, 2019, ['320d', '328i'], ['DE', 'US']],
  ['Mercedes-Benz', 'C-Class', 'W205', 2014, 2021, ['C 200', 'C 220 d'], ['DE', 'US']],
  ['Opel', 'Astra', 'K', 2015, 2021, ['1.4 Turbo', '1.6 CDTI'], ['DE']],
  ['Ford', 'Focus', 'Mk4', 2018, 2025, ['1.0 EcoBoost', '1.5 EcoBlue'], ['DE']],
  ['Skoda', 'Octavia', 'III', 2013, 2020, ['1.5 TSI', '2.0 TDI'], ['DE']],
  ['Renault', 'Clio', 'V', 2019, 2025, ['1.0 TCe', '1.5 dCi'], ['DE']],
  ['Ford', 'F-150', 'Thirteenth', 2015, 2020, ['3.5 EcoBoost', '5.0 V8'], ['US']],
  ['Toyota', 'Camry', 'XV70', 2018, 2024, ['2.5', '3.5 V6'], ['US']],
  ['Toyota', 'Corolla', 'E210', 2019, 2025, ['1.8 Hybrid', '2.0'], ['DE', 'US']],
  ['Chevrolet', 'Silverado 1500', 'Fourth', 2019, 2024, ['5.3 V8', '6.2 V8'], ['US']],
];

export const VEHICLE_RECORDS: VehicleRecord[] = DEFS.flatMap(([make, model, generation, yearFrom, yearTo, engines, markets]) =>
  engines.map((engine) => ({ make, model, generation, yearFrom, yearTo, engine, markets, fitmentKey: `${make}|${model}|${yearFrom}|${yearTo}|${engine}` })),
);
