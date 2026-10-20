// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { StateDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * Order states for collection (`ordered` is initial, transitions in order) and review states. Listed in DEFINITION
 * order; a transition target must exist first, so the seed creates them in `stateCreationOrder()` (reverse).
 * `mcf-review-approved` has the role ReviewIncludedInStatistics (what makes a review count in `reviewRatingStatistics`);
 * `mcf-review-pending` has none, and approved is the target of pending.
 */
const t = (key: string) => ({ typeId: 'state' as const, key });

export const stateDrafts: StateDraft[] = [
  { key: K.orderOrdered, type: 'OrderState', initial: true, name: ls('Ordered', 'Bestellt'), transitions: [t(K.orderPreparing)] },
  { key: K.orderPreparing, type: 'OrderState', initial: false, name: ls('Preparing', 'In Vorbereitung'), transitions: [t(K.orderReady)] },
  { key: K.orderReady, type: 'OrderState', initial: false, name: ls('Ready for collection', 'Abholbereit', 'Ready for collection'), transitions: [t(K.orderCollected)] },
  { key: K.orderCollected, type: 'OrderState', initial: false, name: ls('Collected', 'Abgeholt') },
  { key: K.reviewPending, type: 'ReviewState', initial: true, name: ls('Pending approval', 'Wartet auf Freigabe'), roles: [], transitions: [t(K.reviewApproved)] },
  { key: K.reviewApproved, type: 'ReviewState', initial: false, name: ls('Approved', 'Freigegeben'), roles: ['ReviewIncludedInStatistics'] },
];

/** Targets first: `collected` before `ready`, `approved` before `pending`. */
export const stateCreationOrder = (): StateDraft[] => [...stateDrafts].reverse();
export const orderStateDrafts = (): StateDraft[] => stateDrafts.filter((s) => s.type === 'OrderState');
export const reviewStateDrafts = (): StateDraft[] => stateDrafts.filter((s) => s.type === 'ReviewState');
