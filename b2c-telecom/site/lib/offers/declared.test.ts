/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { cartGroupKeyOf, DEFAULT_DECLARED, groupKeyOf, parseDeclared, serializeDeclared } from './declared';

describe('declared context', () => {
  it('round-trips, and a missing cookie is the default (consumer, not specified)', () => {
    expect(parseDeclared(serializeDeclared({ customerType: 'employee', existing: 'yes' }))).toEqual({ customerType: 'employee', existing: 'yes' });
    expect(parseDeclared(undefined)).toEqual(DEFAULT_DECLARED);
  });

  it('a forged value is ignored half by half', () => {
    expect(parseDeclared('admin:yes')).toEqual({ customerType: 'consumer', existing: 'yes' });
    expect(parseDeclared('employee:maybe')).toEqual({ customerType: 'employee', existing: 'unspecified' });
    expect(parseDeclared('<script>')).toEqual(DEFAULT_DECLARED);
  });

  it('one group per cart: employee, then small business, then existing customer', () => {
    expect(groupKeyOf('employee', true)).toBe('employee');
    expect(groupKeyOf('small-business', true)).toBe('small-business');
    expect(groupKeyOf('consumer', true)).toBe('existing-customer');
    expect(groupKeyOf('consumer', false)).toBeNull();
  });

  it('a signed-in customer gets no declared group on the cart', () => {
    expect(cartGroupKeyOf({ signedIn: true, customerType: 'employee', isExistingCustomer: true })).toBeNull();
    expect(cartGroupKeyOf({ signedIn: false, customerType: 'employee', isExistingCustomer: false })).toBe('employee');
  });
});
