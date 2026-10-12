// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FitBadge } from '@/components/vehicle/FitBadge';
import { FitBanner } from '@/components/vehicle/FitBanner';
import { FitToggle } from '@/components/vehicle/FitToggle';
import { GarageBar } from '@/components/vehicle/GarageBar';
import { VehicleFinderCard } from '@/components/vehicle/VehicleFinderCard';
import { fitScope, getFitState, resolveFitMode } from '@/lib/search/fitment';
import { getActiveVehicle } from '@/lib/vehicles/active';

export const metadata: Metadata = { title: 'Vehicle finder and garage (dev)', robots: { index: false } };

// Sample parts with the seed's range keys (synthetic). Stand-ins for what L and M read from `fitment-keys` and `universal-fit`.
const PARTS = [
  { sku: 'brake-golf-vii-diesel', name: 'Brake pads, Golf VII 2.0 TDI', fitmentKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'], universalFit: false },
  { sku: 'brake-golf-viii-diesel', name: 'Brake pads, Golf VIII 2.0 TDI', fitmentKeys: ['Volkswagen|Golf|2019|2024|2.0 TDI'], universalFit: false },
  { sku: 'filter-a3-petrol', name: 'Air filter, Audi A3 1.4 TFSI', fitmentKeys: ['Audi|A3|2012|2020|1.4 TFSI'], universalFit: false },
  { sku: 'wiper-universal', name: 'Wiper blade, universal', fitmentKeys: [], universalFit: true },
  { sku: 'local-mat', name: 'Boot mat (local part, no fitment data)', fitmentKeys: [], universalFit: false },
];

/**
 * Dev-only specimen of workstream J: finder card, garage bar, fit toggle, fit badges per sample part (server computed with
 * `getFitState`), the search expression `fitScope` builds, and a product page block (quantity plus `FitBanner`).
 * Must not exist in a release build (check-no-dev-pages).
 */
export default async function VehicleSpecimen({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ fit?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { store } = await params;
  const { fit } = await searchParams;
  const vehicle = await getActiveVehicle();
  const mode = resolveFitMode(vehicle, fit);
  const scope = fitScope(vehicle?.fitKeys ?? null, mode);
  const shown = PARTS.filter((p) => mode === 'all' || getFitState(p, vehicle) === 'fits');

  return (
    <div className="mx-auto grid max-w-content gap-5 bg-surface-page p-5 font-body text-text" data-testid="vehicle-specimen">
      <h1 className="font-display text-3xl text-text-strong">Vehicle finder and garage (dev)</h1>
      <VehicleFinderCard partsHref={`/${store}/dev/vehicle`} />
      <GarageBar />
      <FitToggle />
      <section aria-label="Sample listing" className="grid gap-3">
        <p className="font-ui text-sm text-text-muted" data-testid="mode">
          Mode: {mode}
          {vehicle ? `, vehicle ${vehicle.label}, keys ${vehicle.fitKeys.length}` : ', no vehicle'}
        </p>
        <ul className="grid gap-2" data-testid="sample-listing">
          {shown.map((p) => (
            <li key={p.sku} className="flex flex-wrap items-center gap-3 rounded-md bg-surface p-3 shadow-card">
              <span className="font-ui text-sm font-semibold">{p.name}</span>
              <FitBadge state={getFitState(p, vehicle)} />
            </li>
          ))}
        </ul>
        <pre className="overflow-x-auto rounded-sm bg-surface-subtle p-3 font-ui text-xs" data-testid="scope">
          {JSON.stringify(scope, null, 2) ?? 'null'}
        </pre>
      </section>
      <section aria-label="Sample product page" className="grid gap-3 rounded-md bg-surface p-5">
        <h2 className="font-display text-xl">Brake pads, Golf VII 2.0 TDI</h2>
        <FitBanner product={PARTS[0]} alternativesHref={`/${store}/dev/vehicle?fit=1`} />
        <label className="grid max-w-40 gap-1 font-ui text-xs font-bold uppercase tracking-label text-text-muted">
          Quantity
          <input type="number" min={1} defaultValue={1} className="min-h-7 rounded-xs border border-border-strong bg-surface px-3 font-ui text-sm text-text" />
        </label>
      </section>
    </div>
  );
}
