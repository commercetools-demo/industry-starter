/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Assortment state of one master part for one reseller store (spec "Assigned products table"). Pure.
export type AssortmentState = 'inherited' | 'local' | 'available' | 'withdrawn' | 'pre-release' | 'blocked-upstream' | 'pending-review';

export interface Membership {
  /** In `mau-sel-malva-master`. */
  inMaster: boolean;
  /** Listed in `mau-assortment/<storeKey>.blockedUpstream`. */
  blockedUpstream: boolean;
  /** In the store's own selection. */
  inReseller: boolean;
  /** Listed in `withdrawnByReseller`. */
  withdrawnByReseller: boolean;
  preRelease: boolean;
  pendingReview: boolean;
}

export function deriveState(m: Membership): AssortmentState {
  if (!m.inMaster) {
    if (m.pendingReview) return 'pending-review';
    if (m.inReseller) return 'local';
    if (m.withdrawnByReseller) return 'withdrawn';
    return 'available';
  }
  if (m.blockedUpstream) return 'blocked-upstream';
  if (m.inReseller) return 'inherited';
  if (m.withdrawnByReseller) return 'withdrawn';
  if (m.preRelease) return 'pre-release';
  return 'available';
}

export type StateTone = 'success' | 'info' | 'neutral' | 'warning' | 'critical';
export type StateAction = 'withdraw' | 'assign' | 'reinstate' | 'cantReadd' | 'none';

export const STATE_UI: Record<AssortmentState, { tone: StateTone; actionKey: StateAction }> = {
  inherited: { tone: 'success', actionKey: 'withdraw' },
  local: { tone: 'info', actionKey: 'withdraw' },
  available: { tone: 'neutral', actionKey: 'assign' },
  withdrawn: { tone: 'warning', actionKey: 'reinstate' },
  'pre-release': { tone: 'info', actionKey: 'assign' },
  'blocked-upstream': { tone: 'critical', actionKey: 'cantReadd' },
  'pending-review': { tone: 'neutral', actionKey: 'none' },
};

/** States that count as "assigned" (the part is in the store's selection). */
export const ASSIGNED_STATES: readonly AssortmentState[] = ['inherited', 'local'];
