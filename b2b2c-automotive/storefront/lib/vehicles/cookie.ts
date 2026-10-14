// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { cookies } from 'next/headers';
import { parseGarageJson } from '@/lib/ct/vehicles';
import type { Garage } from '@/lib/types';
import { emptyGarage } from './garage';

/** The anonymous garage: HTTP-only cookie holding the same JSON as the customer's `garage` field. No secrets, no personal data. */
export const GARAGE_COOKIE = 'garage';
export const GARAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const garageCookieOptions = (nodeEnv: string | undefined = process.env.NODE_ENV) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: nodeEnv === 'production',
  maxAge: GARAGE_COOKIE_MAX_AGE,
});

/** The cookie garage re-validated against the vehicle table: bad entries are dropped and more than five are cut keeping the active one. */
export async function readAnonymousGarage(): Promise<Garage> {
  const jar = await cookies();
  const raw = jar.get(GARAGE_COOKIE)?.value;
  if (!raw) return emptyGarage();
  return parseGarageJson(raw);
}

export async function writeAnonymousGarage(garage: Garage): Promise<void> {
  const jar = await cookies();
  if (!garage.vehicles.length) {
    jar.delete(GARAGE_COOKIE);
    return;
  }
  jar.set(GARAGE_COOKIE, JSON.stringify(garage), garageCookieOptions());
}

/** Called by the sign-in route after `mergeGarageOnSignIn`. */
export async function clearAnonymousGarage(): Promise<void> {
  const jar = await cookies();
  jar.delete(GARAGE_COOKIE);
}
