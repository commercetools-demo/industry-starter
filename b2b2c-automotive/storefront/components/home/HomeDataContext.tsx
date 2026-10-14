// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The server-read home data (lib/ct/home.ts) for the blocks. Blocks never fetch their own content (workstream K, D7).
import { createContext, useContext, type ReactNode } from 'react';
import type { HomeData } from '@/lib/home/types';

const HomeDataContext = createContext<HomeData | null>(null);

export function HomeDataProvider({ value, children }: { value: HomeData; children: ReactNode }) {
  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
}

export function useHomeData(): HomeData {
  const value = useContext(HomeDataContext);
  if (!value) throw new Error('useHomeData must be used inside a HomeDataProvider (the home page wraps its blocks in one).');
  return value;
}
