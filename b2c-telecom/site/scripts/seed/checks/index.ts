/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Registry of seed:verify checks. Workstream G appends checks/catalog.ts, X appends checks/releases.ts.
import { catalogChecks } from './catalog';
import { platformChecks, type Check } from './platform';
import { releaseChecks } from './releases';

export type { Check, CheckResult } from './platform';

export const checks: Check[] = [...platformChecks, ...catalogChecks, ...releaseChecks];
