/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { ApiError } from '@/lib/api';
import type { Session } from '@/lib/types';

/** A resource of another business unit or store is "not found", never "forbidden" (no existence leak). */
export async function requireOwnership(session: Session, resource: { businessUnitKey?: string; storeKey?: string }): Promise<void> {
  if (resource.businessUnitKey !== undefined && resource.businessUnitKey !== session.businessUnitKey) throw new ApiError(404, 'Not found');
  if (resource.storeKey !== undefined && resource.storeKey !== session.storeKey) throw new ApiError(404, 'Not found');
}
