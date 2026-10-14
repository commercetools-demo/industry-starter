/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { errorResponse, json } from '@/lib/ct/http';
import { toSummary } from '@/lib/ct/identity';
import { getSession } from '@/lib/ct/session';

// Reference Route Handler: reads the signed session and answers the browser-safe summary. Never sets a cookie.
export async function GET() {
  try {
    return json({ session: toSummary(await getSession()) });
  } catch (err) {
    return errorResponse(err);
  }
}
