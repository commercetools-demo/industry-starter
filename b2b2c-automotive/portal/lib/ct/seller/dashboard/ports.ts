// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Everything the dashboard reads, behind one interface. Live: the modules of this folder (admin client). Development with
// PORTAL_DEV_FIXTURES=on (never production): the synthetic dataset of `fixtures.ts`, so the page can be run without credentials.
import 'server-only';
import { devFixturesEnabled } from '@/lib/portal/seam';
import type { BranchStock, DashboardOrder, HeadsUp, RenewalRow, ReturnRow, StoreHeader, StorePerformance } from '@/lib/dashboard/types';

export interface DashboardPorts {
  openOrders(storeKey: string): Promise<number>;
  recentOrders(storeKey: string): Promise<DashboardOrder[]>;
  openReturns(storeKey: string): Promise<number>;
  returnsToHandle(storeKey: string): Promise<ReturnRow[]>;
  activeSubscriptions(storeKey: string): Promise<number>;
  renewals(storeKey: string): Promise<RenewalRow[]>;
  unansweredReviews(storeKey: string): Promise<number>;
  lowStock(storeKey: string): Promise<BranchStock[]>;
  headsUp(storeKey: string): Promise<HeadsUp | null>;
  storePerformance(storeKey: string): Promise<StorePerformance>;
  storeHeader(storeKey: string): Promise<StoreHeader>;
}

/** The live implementation is imported on first use so a fixture run never loads the admin client (which needs credentials). */
const lazy = <K extends keyof DashboardPorts>(name: K): DashboardPorts[K] =>
  (async (...args: unknown[]) => {
    const live = (await import('./live-ports')).liveDashboardPorts;
    return (live[name] as (...a: unknown[]) => Promise<unknown>)(...args);
  }) as DashboardPorts[K];

const livePorts: DashboardPorts = {
  openOrders: lazy('openOrders'),
  recentOrders: lazy('recentOrders'),
  openReturns: lazy('openReturns'),
  returnsToHandle: lazy('returnsToHandle'),
  activeSubscriptions: lazy('activeSubscriptions'),
  renewals: lazy('renewals'),
  unansweredReviews: lazy('unansweredReviews'),
  lowStock: lazy('lowStock'),
  headsUp: lazy('headsUp'),
  storePerformance: lazy('storePerformance'),
  storeHeader: lazy('storeHeader'),
};

export function getDashboardPorts(): DashboardPorts {
  if (!devFixturesEnabled()) return livePorts;
  // Synchronous facade over the lazily loaded fixture module (it is plain data, no credentials).
  const fixtures = <K extends keyof DashboardPorts>(name: K) =>
    (async (...args: unknown[]) => {
      const mod = await import('./fixtures');
      return (mod.fixtureDashboardPorts[name] as (...a: unknown[]) => Promise<unknown>)(...args);
    }) as DashboardPorts[K];
  return {
    openOrders: fixtures('openOrders'),
    recentOrders: fixtures('recentOrders'),
    openReturns: fixtures('openReturns'),
    returnsToHandle: fixtures('returnsToHandle'),
    activeSubscriptions: fixtures('activeSubscriptions'),
    renewals: fixtures('renewals'),
    unansweredReviews: fixtures('unansweredReviews'),
    lowStock: fixtures('lowStock'),
    headsUp: fixtures('headsUp'),
    storePerformance: fixtures('storePerformance'),
    storeHeader: fixtures('storeHeader'),
  };
}
