// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { setActive, toGarageState } from '@/lib/vehicles/garage';
import { isVehicleId } from '@/lib/vehicles/id';
import { mutateGarage } from '@/lib/vehicles/service';

const body = z.object({ vehicleId: z.string().refine(isVehicleId, 'Invalid vehicle id') });

/** Switches the active vehicle to one already in the garage. */
export const POST = handle(async (request: Request) => {
  const { vehicleId } = await parseJson(request, body);
  const garage = await mutateGarage((current) => {
    if (!current.vehicles.some((v) => v.id === vehicleId)) throw new ApiError(404, 'Vehicle is not in the garage');
    return setActive(current, vehicleId);
  });
  return Response.json(toGarageState(garage), { headers: { 'Cache-Control': 'private, no-store' } });
});
