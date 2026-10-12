// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { listVehicleRecords } from '@/lib/ct/vehicles';
import type { Garage, GarageVehicle } from '@/lib/types';
import { findFitmentKeyFor, vehicleFromId } from '@/lib/vehicles/catalog';
import { addVehicle, NICKNAME_MAX, removeVehicle, toGarageState } from '@/lib/vehicles/garage';
import { isVehicleId } from '@/lib/vehicles/id';
import { mutateGarage, readGarage } from '@/lib/vehicles/service';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const respond = (garage: Garage) => Response.json(toGarageState(garage), { headers: NO_STORE });

const addBody = z.object({
  vehicleId: z.string().refine(isVehicleId, 'Invalid vehicle id'),
  nickname: z.string().trim().max(NICKNAME_MAX, 'Nickname is too long').optional(),
});

/** The shopper's garage: `{ garage, vehicles, active }`. Customer field when signed in, cookie otherwise. */
export const GET = handle(async () => respond(await readGarage()));

/** Adds a vehicle (validated against the vehicle table) and makes it active. A sixth vehicle drops the oldest non-active one. */
export const POST = handle(async (request: Request) => {
  const { vehicleId, nickname } = await parseJson(request, addBody);
  const records = await listVehicleRecords();
  const vehicle = vehicleFromId(records, vehicleId);
  if (!vehicle) throw new ApiError(400, 'Unknown vehicle');
  const entry: GarageVehicle = {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    engine: vehicle.engine,
    fitmentKey: findFitmentKeyFor(records, vehicle) ?? '',
    ...(nickname ? { nickname } : {}),
  };
  return respond(await mutateGarage((garage) => addVehicle(garage, entry)));
});

/** `DELETE /api/garage?vehicleId=...` removes a vehicle; removing the active one activates the newest remaining. */
export const DELETE = handle(async (request: Request) => {
  const vehicleId = new URL(request.url).searchParams.get('vehicleId');
  if (!vehicleId || !isVehicleId(vehicleId)) throw new ApiError(400, 'Invalid vehicle id');
  return respond(await mutateGarage((garage) => removeVehicle(garage, vehicleId)));
});
