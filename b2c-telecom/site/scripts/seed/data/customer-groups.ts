/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { CustomerGroupDraft } from '../types';

export const customerGroups: CustomerGroupDraft[] = [
  { key: 'consumer', groupName: 'Consumer' },
  { key: 'small-business', groupName: 'Small business' },
  { key: 'employee', groupName: 'Employee' },
  { key: 'existing-customer', groupName: 'Existing customer' },
  { key: 'call-center', groupName: 'Call center' },
];
