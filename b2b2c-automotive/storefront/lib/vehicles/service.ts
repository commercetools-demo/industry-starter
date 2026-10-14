// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { cache } from 'react';
import { parseGarageJson, readCustomerGarage, updateCustomerGarage } from '@/lib/ct/vehicles';
import { getSession } from '@/lib/session';
import type { Garage, GarageState } from '@/lib/types';
import { readAnonymousGarage, writeAnonymousGarage } from './cookie';
import { toGarageState } from './garage';

/** The shopper's garage: the customer field when signed in, the cookie otherwise. Read once per request. */
export const readGarage = cache(async (): Promise<Garage> => {
  const session = await getSession();
  if (session.customerId) return (await readCustomerGarage(session.customerId)).garage;
  return readAnonymousGarage();
});

/** Applies `update` to the shopper's garage and persists it (customer field with a 409 retry, or the cookie). Returns the saved garage. */
export async function mutateGarage(update: (garage: Garage) => Garage): Promise<Garage> {
  const session = await getSession();
  if (session.customerId) return updateCustomerGarage(session.customerId, update);
  const next = await parseGarageJson(update(await readAnonymousGarage()));
  await writeAnonymousGarage(next);
  return next;
}

/** Server read for the first paint (the SWR fallback of `GarageProvider`). */
export async function readGarageState(): Promise<GarageState> {
  // `toGarageState` is pure; the garage itself was already validated against the vehicle table.
  return toGarageState(await readGarage());
}
