// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { StateDraft } from '@commercetools/platform-sdk';
import { STATE_READY_FOR_PICKUP, ls } from './base';

/**
 * Order state `ready-for-pickup` (workstreams P, Q, W read it by this key). `transitions` is left unset on purpose: the
 * platform then performs no validation, so the portal can set it from any state and the order shows "Ready for pickup".
 */
export const stateDrafts: StateDraft[] = [
  {
    key: STATE_READY_FOR_PICKUP, type: 'OrderState', initial: false,
    name: ls('Abholbereit', 'Ready for pickup'), description: ls('Die Teile liegen in der gewählten Filiale bereit.', 'The parts are waiting at the chosen branch.'),
  },
];
