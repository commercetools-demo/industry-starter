/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { computeServiceStart } from './serviceStart';

const plan = (technology: 'cable' | 'fixed-wireless' | 'mobile') => ({ kind: 'plan' as const, technology });

describe('computeServiceStart', () => {
  it('cable plus phone: the longest lead', () => expect(computeServiceStart([plan('cable'), plan('mobile')], '2026-10-07')).toBe('2026-10-12'));
  it('cable only: +5 days', () => expect(computeServiceStart([plan('cable')], '2026-10-07')).toBe('2026-10-12'));
  it('phone only: the order date', () => expect(computeServiceStart([plan('mobile')], '2026-10-07')).toBe('2026-10-07'));
  it('add-on only: the order date', () => expect(computeServiceStart([{ kind: 'addon', technology: null }], '2026-10-07')).toBe('2026-10-07'));
});
