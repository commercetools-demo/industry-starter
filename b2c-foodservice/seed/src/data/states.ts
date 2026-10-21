// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { StateDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * Order states for collection (`ordered` is initial, transitions in order). There are no review states: reviews are not moderated (D-037) and count in statistics at once. Listed in DEFINITION
 * order; a transition target must exist first, so the seed creates them in `stateCreationOrder()` (reverse).
 */
const t = (key: string) => ({ typeId: 'state' as const, key });

export const stateDrafts: StateDraft[] = [
  { key: K.orderOrdered, type: 'OrderState', initial: true, name: ls('Ordered'), transitions: [t(K.orderPreparing)] },
  { key: K.orderPreparing, type: 'OrderState', initial: false, name: ls('Preparing'), transitions: [t(K.orderReady)] },
  { key: K.orderReady, type: 'OrderState', initial: false, name: ls('Ready for collection'), transitions: [t(K.orderCollected)] },
  { key: K.orderCollected, type: 'OrderState', initial: false, name: ls('Collected') },
];

/** Targets first: `collected` before `ready`. */
export const stateCreationOrder = (): StateDraft[] => [...stateDrafts].reverse();
export const orderStateDrafts = (): StateDraft[] => stateDrafts.filter((s) => s.type === 'OrderState');
