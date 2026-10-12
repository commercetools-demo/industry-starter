// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { getVehicleById } from '@/lib/ct/vehicles';
import { getProvider, isLookupEnabled } from '@/lib/vehicles';
import { PLATE_COUNTRIES, type LookupResult } from '@/lib/vehicles/provider';
import { createRateLimiter } from '@/lib/vehicles/rate-limit';
import { validatePlate, validateVin } from '@/lib/vehicles/validate';

const body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plate'), plate: z.string().max(40), country: z.enum(PLATE_COUNTRIES as [string, ...string[]], { error: 'Invalid country' }) }),
  z.object({ type: z.literal('vin'), vin: z.string().max(40) }),
]);

// 10 lookups per minute per session (falls back to the caller address without a session cookie).
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function callerKey(request: Request): string {
  const cookie = /(?:^|;\s*)malva_session=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
  const raw = cookie ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return createHash('sha256').update(raw).digest('hex');
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const reply = (result: LookupResult) => Response.json(result, { headers: NO_STORE });

/**
 * Plate and VIN lookup through the configured provider (the mock, `Demo lookup`). A failed lookup is a result with HTTP 200, not an error.
 * Never saves to the garage (saving is the shopper's confirmation) and never logs the plate or VIN.
 */
export const POST = handle(async (request: Request) => {
  if (!isLookupEnabled()) throw new ApiError(404, 'Not found');
  const input = await parseJson(request, body);
  if (!limiter.take(callerKey(request))) {
    return Response.json({ error: 'Too many lookups, try again in a minute' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const provider = getProvider();
  let result: LookupResult;
  try {
    if (input.type === 'plate') {
      const plate = validatePlate(input.plate);
      if (!plate.ok) return reply({ status: 'invalid', reason: plate.reason });
      result = await provider.lookupPlate({ plate: plate.value, country: input.country as 'DE' | 'AT' | 'CH' | 'US' });
    } else {
      const vin = validateVin(input.vin);
      if (!vin.ok) return reply({ status: 'invalid', reason: vin.reason });
      result = await provider.lookupVin({ vin: vin.value });
    }
  } catch (error) {
    console.error(`[vehicle-lookup] provider ${provider.id} failed (${error instanceof Error ? error.constructor.name : typeof error})`);
    return reply({ status: 'unavailable' });
  }
  // A vehicle outside the vehicle table could never be filtered by fit, so it is not offered.
  if (result.status === 'resolved' && !(await getVehicleById(result.vehicle.id))) return reply({ status: 'not-found' });
  return reply(result);
});
