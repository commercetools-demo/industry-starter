/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { adminRoot } from '@/lib/ct/admin-client';

const TYPE_KEY = 'malva-customer';

/**
 * Stamps `custom.fields.lastActiveAt` after a successful sign-in (R-06; U's Users table reads it). One update, one retry on a
 * version conflict. Failures are swallowed: this never blocks a login.
 */
export async function touchLastActive(customerId: string, now: Date = new Date()): Promise<void> {
  const lastActiveAt = now.toISOString();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { body } = await adminRoot.customers().withId({ ID: customerId }).get().execute();
      const hasType = body.custom?.type.id !== undefined && body.custom.fields !== undefined;
      await adminRoot
        .customers()
        .withId({ ID: customerId })
        .post({
          body: {
            version: body.version,
            actions: hasType
              ? [{ action: 'setCustomField', name: 'lastActiveAt', value: lastActiveAt }]
              : [{ action: 'setCustomType', type: { typeId: 'type', key: TYPE_KEY }, fields: { lastActiveAt } }],
          },
        })
        .execute();
      return;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 409) return;
    }
  }
}
