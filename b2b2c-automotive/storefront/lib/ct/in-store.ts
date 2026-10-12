// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { ByProjectKeyInStoreKeyByStoreKeyRequestBuilder } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';

/** commercetools key pattern; a store key from a URL is checked against it before it reaches the API. */
export const KEY_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;

/** Store scoped request builder (`/in-store/key=...`): carts, orders and customers of one reseller store. */
export function inStore(storeKey: string): ByProjectKeyInStoreKeyByStoreKeyRequestBuilder {
  if (!KEY_PATTERN.test(storeKey)) throw new Error('Invalid store key');
  return apiRoot.inStoreKeyWithStoreKeyValue({ storeKey });
}
