// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Vehicle ids: pure, safe in client code. The id identifies one vehicle the shopper owns (a year), never a range.
import type { VehicleId } from '@/lib/types';

export const VEHICLE_ID_PATTERN = /^[a-z0-9-]+\.[a-z0-9-]+\.\d{4}\.[a-z0-9-]+$/;

/** Lowercase `[a-z0-9-]+` slug, like the seed's `slugify` (umlauts transliterated, other characters become one dash). */
export function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface VehicleParts {
  make: string;
  model: string;
  year: number;
  engine: string;
}

export function buildVehicleId(parts: VehicleParts): VehicleId {
  return [slugPart(parts.make), slugPart(parts.model), String(parts.year), slugPart(parts.engine)].join('.');
}

export const isVehicleId = (value: unknown): value is VehicleId => typeof value === 'string' && VEHICLE_ID_PATTERN.test(value);

/** The slug parts of an id (make, model and engine stay slugs), or null for anything that is not an id. */
export function parseVehicleId(id: string): VehicleParts | null {
  if (!isVehicleId(id)) return null;
  const [make, model, year, engine] = id.split('.');
  return { make, model, year: Number(year), engine };
}
