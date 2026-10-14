/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { createStubSlotService } from './stub-service';
import type { SlotService } from './types';

export type { Slot, SlotService } from './types';

let service: SlotService | undefined;

/** The process-wide slot service (in-memory stub, SO-12). */
export function getSlotService(): SlotService {
  service ??= createStubSlotService();
  return service;
}

/** Test seam: replace (or reset with no argument) the singleton. */
export function setSlotService(next?: SlotService): void {
  service = next;
}
