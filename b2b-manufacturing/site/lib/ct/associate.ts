/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { apiRoot } from './client';
import type { Session } from '../session-core';

/** Every signed-in write on carts, quote requests, quotes and orders goes through this chain. */
export function asAssociate(session: Pick<Session, 'customerId' | 'businessUnitKey'>) {
  if (!session.customerId || !session.businessUnitKey) throw new Error('asAssociate needs customerId and businessUnitKey in the session');
  return apiRoot.asAssociate().withAssociateIdValue({ associateId: session.customerId }).inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: session.businessUnitKey });
}
