/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import 'server-only';

describe('server-only alias', () => {
  it('lets a file that imports server-only run under Vitest', () => {
    expect(true).toBe(true);
  });
});
