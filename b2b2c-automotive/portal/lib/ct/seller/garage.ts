// Read-only view of a shopper's garage (V-05). The garage is the `garage` field of the seed type `malva-customer`: a JSON string
// `{ vehicles: [{ id, make, model, year, engine, ... }], activeId }` with at most 5 vehicles (Q-J04), the same shape guard as
// `storefront/lib/vehicles/garage.ts`. Anything that does not fit is dropped; the portal never writes the garage.
import 'server-only';
import type { GarageVehicleView } from '@/lib/v-types';

const MAX_VEHICLES = 5;
const MAX_JSON_LENGTH = 16_000;

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 120;

export function parseGarage(input: unknown): GarageVehicleView[] {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (input.length > MAX_JSON_LENGTH) return [];
    try {
      value = JSON.parse(input);
    } catch {
      return [];
    }
  }
  const vehicles = (value as { vehicles?: unknown } | null)?.vehicles;
  if (!Array.isArray(vehicles)) return [];
  const out: GarageVehicleView[] = [];
  for (const entry of vehicles.slice(0, MAX_VEHICLES)) {
    const v = entry as { id?: unknown; make?: unknown; model?: unknown; year?: unknown; engine?: unknown };
    if (!isText(v.id) || !isText(v.make) || !isText(v.model) || typeof v.year !== 'number' || !Number.isInteger(v.year)) continue;
    out.push({ id: v.id, label: `${v.year} ${v.make} ${v.model}${isText(v.engine) ? ` · ${v.engine}` : ''}` });
  }
  return out;
}
