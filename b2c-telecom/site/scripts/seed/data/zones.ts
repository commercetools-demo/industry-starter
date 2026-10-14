/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ZoneCoverageDraft } from '../types';
import { MARKETS } from './market';

// Coverage, not ownership: the existing zones holding US and DE are adopted (a country belongs to one zone only).
export const zoneCoverage: ZoneCoverageDraft[] = MARKETS.map((m) => ({ key: m.country, country: m.country }));
