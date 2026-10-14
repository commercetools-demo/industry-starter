/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { RecurrencePolicyDraft } from '../types';

export const recurrencePolicies: RecurrencePolicyDraft[] = [
  {
    key: 'malva-monthly',
    name: { 'en-US': 'Monthly', 'de-DE': 'Monatlich' },
    description: { 'en-US': 'One order every month.', 'de-DE': 'Eine Bestellung pro Monat.' },
    schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
  },
];
