/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { stateOfZip } from './zip-state';

describe('stateOfZip', () => {
  it.each([
    ['10001', 'NY'],
    ['27517', 'NC'],
    ['30301', 'GA'],
    ['75001', 'TX'],
    ['94105', 'CA'],
    ['97201', 'OR'],
    ['98101', 'WA'],
    ['59001', 'MT'],
    ['60601', 'IL'],
    ['73301', 'TX'],
    ['99501', 'AK'],
  ])('%s is in %s', (zip, state) => expect(stateOfZip(zip, 'US')).toBe(state));

  it('is undefined for another country, a malformed ZIP or a prefix no state owns', () => {
    expect(stateOfZip('10115', 'DE')).toBeUndefined();
    expect(stateOfZip('1234', 'US')).toBeUndefined();
    expect(stateOfZip('00123', 'US')).toBeUndefined();
  });
});
