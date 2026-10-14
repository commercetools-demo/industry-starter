/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

describe('offline guard', () => {
  it('rejects fetch with a clear message', async () => {
    await expect(async () => fetch('https://example.com')).rejects.toThrow('Network is disabled in unit tests');
  });
});
