/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface PaletteApi {
  query: string;
  setQuery: (q: string) => void;
}

const PaletteContext = createContext<PaletteApi | null>(null);

/** The palette's text lives here so the top-bar search can open it prefilled. */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette(): PaletteApi {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette needs PaletteProvider');
  return ctx;
}
