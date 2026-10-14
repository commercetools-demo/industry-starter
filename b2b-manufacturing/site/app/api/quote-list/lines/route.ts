/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { addLineHandler } from '@/lib/quote/list-api';

/** POST /api/quote-list/lines: add a service (contract with components/service/AddToQuoteList). */
export const POST = addLineHandler;
