/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { cx } from './cx';

describe('cx', () => {
  it('joins strings and skips false, null, undefined and empty parts', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});
