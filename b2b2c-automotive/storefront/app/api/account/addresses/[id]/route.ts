// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `PUT /api/account/addresses/{id}` an address -> the book; `PATCH` makes it the default; `DELETE` removes it (workstream Q-09).
// An id that is not one of the session customer's addresses is a 404.
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { addressBody } from '@/lib/account/address-schema';
import { parseJson } from '@/lib/api';
import { changeAddress, removeAddress, setDefaultAddress } from '@/lib/ct/account-addresses';
import { getStoreContext } from '@/lib/ct/stores';

type Context = { params: Promise<{ id: string }> };

/** The book plus the store's countries, so the client keeps the form's country list after every write. */
async function withCountries(storeKey: string, book: object): Promise<Response> {
  const countries = (await getStoreContext(storeKey))?.countries ?? [];
  return Response.json({ ...book, countries }, { headers: NO_STORE });
}

export const PUT = accountHandle(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, addressBody);
  const countries = (await getStoreContext(storeKey))?.countries ?? [];
  return Response.json({ ...(await changeAddress(storeKey, customerId, id, input, countries)), countries }, { headers: NO_STORE });
});

export const PATCH = accountHandle(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const { storeKey, customerId } = await accountSession();
  return withCountries(storeKey, await setDefaultAddress(storeKey, customerId, id));
});

export const DELETE = accountHandle(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  const { storeKey, customerId } = await accountSession();
  return withCountries(storeKey, await removeAddress(storeKey, customerId, id));
});
