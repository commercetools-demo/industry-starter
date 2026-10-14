/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { vi } from 'vitest';

/**
 * Pathname seen by `usePathname` in tests (what Next gives after the proxy: with the locale prefix).
 * Usage in a test file:
 *   vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal()));
 *   setPathname('/en-US/doctors/remote');
 */
let pathname = '/en-US';

export function setPathname(next: string): void {
  pathname = next;
}

export function navigationMock<T extends object>(original: T): T & { usePathname: () => string } {
  return { ...original, usePathname: vi.fn(() => pathname) };
}
