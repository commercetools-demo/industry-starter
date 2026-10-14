/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { maskCustomer, maskEmail } from './mask';

const customer = { id: 'c1', email: 'anna.beispiel@example.de', mobile: '+49 151 0000', addresses: [{ city: 'Berlin' }] };

describe('mask email and role', () => {
  it('masks list rows', () => {
    expect(maskEmail('anna.beispiel@example.de')).toBe('a***@e***.de');
    expect(maskEmail('x@mail.example.co.uk')).toBe('x***@m***.uk');
    expect(maskEmail('not-an-email')).toBe('***');
  });
  it('shows the detail unmasked to an Admin only', () => {
    expect(maskCustomer(customer, 'admin')).toEqual(customer);
    const masked = maskCustomer(customer, 'buyer');
    expect(masked.email).toBe('a***@e***.de');
    expect('mobile' in masked).toBe(false);
    expect('addresses' in masked).toBe(false);
  });
});
