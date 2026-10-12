// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Name, region and currency of the store for the page subtitle (decision 8 of the greeting is in the page). Read from the
// `store-settings` custom fields of the store, never from constants.
import 'server-only';
import { adminRoot } from '@/lib/ct/admin-client';
import { withTimeout } from './timeout';
import type { StoreHeader } from '@/lib/dashboard/types';

export function getStoreHeader(storeKey: string): Promise<StoreHeader> {
  return withTimeout(
    adminRoot
      .stores()
      .withKey({ key: storeKey })
      .get()
      .execute()
      .then(({ body }) => {
        const fields = body.custom?.fields ?? {};
        return {
          name: body.name ?? { 'en-US': storeKey },
          region: typeof fields.defaultCountry === 'string' ? fields.defaultCountry : '',
          currency: typeof fields.currency === 'string' ? fields.currency : '',
        };
      }),
  );
}
