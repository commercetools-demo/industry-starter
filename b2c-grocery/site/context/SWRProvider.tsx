/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/**
 * Client boundary for `SWRConfig` (swr is not a server module). The server layout passes plain data as `fallback`
 * so the first paint already has the cart (no spinner flash); SWR revalidates it on mount.
 */
export function SWRProvider({ fallback, children }: { fallback: Record<string, unknown>; children: ReactNode }) {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}
