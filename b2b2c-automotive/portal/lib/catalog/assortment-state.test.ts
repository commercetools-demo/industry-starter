/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { deriveState, STATE_UI, type Membership } from './assortment-state';

const none: Membership = { inMaster: true, blockedUpstream: false, inReseller: false, withdrawnByReseller: false, preRelease: false, pendingReview: false };

describe('deriveState', () => {
  it('Inherited: in master and in the reseller selection (success, Withdraw here)', () => {
    expect(deriveState({ ...none, inReseller: true })).toBe('inherited');
    expect(STATE_UI.inherited).toEqual({ tone: 'success', actionKey: 'withdraw' });
  });
  it('Local addition: not in master, in the reseller selection (info, Withdraw here)', () => {
    expect(deriveState({ ...none, inMaster: false, inReseller: true })).toBe('local');
    expect(STATE_UI.local).toEqual({ tone: 'info', actionKey: 'withdraw' });
  });
  it('Available: in master, not assigned (neutral, Assign)', () => {
    expect(deriveState(none)).toBe('available');
    expect(STATE_UI.available).toEqual({ tone: 'neutral', actionKey: 'assign' });
  });
  it('Withdrawn by you: in master, not in selection, flagged (warning, Reinstate)', () => {
    expect(deriveState({ ...none, withdrawnByReseller: true })).toBe('withdrawn');
    expect(STATE_UI.withdrawn).toEqual({ tone: 'warning', actionKey: 'reinstate' });
  });
  it('Pre-release: configured but not priced (info, Assign)', () => {
    expect(deriveState({ ...none, preRelease: true })).toBe('pre-release');
    expect(STATE_UI['pre-release']).toEqual({ tone: 'info', actionKey: 'assign' });
  });
  it("Blocked upstream wins over everything in master (critical, disabled Can't re-add)", () => {
    expect(deriveState({ ...none, blockedUpstream: true, withdrawnByReseller: true })).toBe('blocked-upstream');
    expect(deriveState({ ...none, blockedUpstream: true, inReseller: true })).toBe('blocked-upstream');
    expect(STATE_UI['blocked-upstream']).toEqual({ tone: 'critical', actionKey: 'cantReadd' });
  });
  it('Awaiting Malva review: not in master and pending, neutral, no action', () => {
    expect(deriveState({ ...none, inMaster: false, pendingReview: true })).toBe('pending-review');
    expect(STATE_UI['pending-review']).toEqual({ tone: 'neutral', actionKey: 'none' });
  });
  it('a local part withdrawn by the reseller reads Withdrawn', () => {
    expect(deriveState({ ...none, inMaster: false, withdrawnByReseller: true })).toBe('withdrawn');
  });
});
