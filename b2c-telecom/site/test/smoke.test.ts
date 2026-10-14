/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

describe('smoke', () => {
  it('computes', () => {
    expect(1 + 1).toBe(2);
  });
  it('has a jsdom document body', () => {
    expect(document.body).toBeDefined();
  });
});
