/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { parseDescription, type CategoryName } from './parse-description';

const CATS: CategoryName[] = [
  { key: 'mau-cat-discs', names: ['Bremsscheiben', 'Brake discs'] },
  { key: 'mau-cat-pads', names: ['Bremsbeläge', 'Brake pads', 'Pads'] },
  { key: 'mau-cat-filters', names: ['Filter', 'Filters'] },
];

describe('audience parse', () => {
  it('"Customers who bought brake discs but not pads" gives a rule with the two category keys', () => {
    const result = parseDescription('Customers who bought brake discs but not pads', CATS);
    expect(result).toEqual({ ok: true, rule: { all: [{ type: 'bought-category', categoryKey: 'mau-cat-discs' }, { type: 'not-bought-category', categoryKey: 'mau-cat-pads' }] } });
  });
  it('matches case-insensitively and the German name', () => {
    expect(parseDescription('CUSTOMERS WHO BOUGHT Bremsscheiben.', CATS)).toEqual({ ok: true, rule: { all: [{ type: 'bought-category', categoryKey: 'mau-cat-discs' }] } });
  });
  it('parses an idle period', () => {
    expect(parseDescription('Customers who have not ordered in 3 months', CATS)).toEqual({ ok: true, rule: { all: [{ type: 'no-order-since', days: 90 }] } });
    expect(parseDescription('have not ordered in 2 weeks', CATS)).toEqual({ ok: true, rule: { all: [{ type: 'no-order-since', days: 14 }] } });
  });
  it('parses registered customers', () => {
    expect(parseDescription('Registered customers', CATS)).toEqual({ ok: true, rule: { all: [{ type: 'registered' }] } });
  });
  it('an unknown phrase or category returns the hint and the categories', () => {
    const result = parseDescription('people who like turbo chargers', CATS);
    expect(result).toEqual({ ok: false, hint: 'Try: customers who bought <category> but not <category>', categories: ['Bremsscheiben', 'Bremsbeläge', 'Filter'] });
    expect(parseDescription('customers who bought wheels but not pads', CATS).ok).toBe(false);
  });
});
