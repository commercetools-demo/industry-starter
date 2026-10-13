// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `GET /api/account/addresses` -> `{ addresses, defaultShippingAddressId, countries }`; `POST` an address -> the same (workstream Q-09).
// Countries come from the store; at most twenty addresses.
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { addressBody } from '@/lib/account/address-schema';
import { parseJson } from '@/lib/api';
import { addAddress, listAddresses } from '@/lib/ct/account-addresses';
import { getStoreContext } from '@/lib/ct/stores';

const countriesOf = async (storeKey: string): Promise<string[]> => (await getStoreContext(storeKey))?.countries ?? [];

export const GET = accountHandle(async () => {
  const { storeKey, customerId } = await accountSession();
  const [book, countries] = await Promise.all([listAddresses(storeKey, customerId), countriesOf(storeKey)]);
  return Response.json({ ...book, countries }, { headers: NO_STORE });
});

export const POST = accountHandle(async (request: Request) => {
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, addressBody);
  const countries = await countriesOf(storeKey);
  return Response.json({ ...(await addAddress(storeKey, customerId, input, countries)), countries }, { headers: NO_STORE });
});
