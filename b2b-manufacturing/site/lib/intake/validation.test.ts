/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validateIntake } from './validation';

const file = (name: string, size = 10) => ({ name, size });

describe('intake-submission › validation', () => {
  it('accepts files for a cart', () => {
    expect(validateIntake({ outputType: 'Cart', files: [file('po.pdf')] })).toBeNull();
  });
  it('accepts text only', () => {
    expect(validateIntake({ outputType: 'QuoteRequest', text: '10 x pipe', files: [] })).toBeNull();
  });
  it('refuses nothing to submit', () => {
    expect(validateIntake({ outputType: 'Cart', text: '  ', files: [] })).toEqual({ code: 'NothingToSubmit' });
  });
  it('refuses a fourth file', () => {
    expect(validateIntake({ outputType: 'Cart', files: ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'].map((n) => file(n)) })).toEqual({ code: 'TooManyFiles' });
  });
  it('refuses an unsupported type and names the file', () => {
    expect(validateIntake({ outputType: 'Cart', files: [file('photo.png')] })).toEqual({ code: 'UnsupportedFile', fileName: 'photo.png' });
  });
  it('refuses an oversized file and names it', () => {
    expect(validateIntake({ outputType: 'Cart', files: [file('big.xlsx', MAX_FILE_BYTES + 1)] })).toEqual({ code: 'FileTooLarge', fileName: 'big.xlsx' });
  });
  it('matches extensions case-insensitively', () => {
    expect(validateIntake({ outputType: 'Cart', files: [file('LIST.CSV')] })).toBeNull();
  });
  it('requires a list name for a shopping list only', () => {
    expect(validateIntake({ outputType: 'ShoppingList', text: 'x', files: [] })).toEqual({ code: 'MissingListName' });
    expect(validateIntake({ outputType: 'ShoppingList', listName: 'Q3', text: 'x', files: [] })).toBeNull();
    expect(validateIntake({ outputType: 'Cart', text: 'x', files: [] })).toBeNull();
  });
  it('refuses an unknown output type', () => {
    expect(validateIntake({ outputType: 'Order', text: 'x', files: [] })).toEqual({ code: 'InvalidOutputType' });
  });
});
