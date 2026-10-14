/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { handle, ok } from '@/lib/api';
import { getRequestContext } from '@/lib/ct/quote-requests';
import { getSession } from '@/lib/session';

/** Prefill data for the request form: company, sites, contact and whether the role may submit. Anonymous visitors get an empty context (status 200). */
export const GET = handle(async () => ok(await getRequestContext(await getSession())));
