/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { OutputType } from './validation';

/** The entity Intake created: a reference only (`cartId` is set for a Quote Request). */
export interface IntakeEntity { type: OutputType; id: string; cartId?: string }

export type IntakeStatus = 'processing' | 'done' | 'failed';

/** One submission as the list shows it. Stored as a Custom Object (lib/ct/intake-records.ts). */
export interface IntakeRecord {
  id: string;
  status: IntakeStatus;
  outputType: OutputType;
  listName?: string;
  fileNames: string[];
  customerId: string;
  createdAt: string;
  completedAt?: string;
  entity?: IntakeEntity;
  warnings: string[];
  errorCode?: string;
  errorMessage?: string;
}
