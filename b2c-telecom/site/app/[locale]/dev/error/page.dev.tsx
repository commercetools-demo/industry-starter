/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Development-only trigger for the server-error page (/en-US/dev/error). `.dev.tsx` is a page extension only in `next dev` (next.config.ts).
import { notFound } from 'next/navigation';

export default function DevErrorPage(): never {
  if (process.env.NODE_ENV !== 'development') notFound();
  throw new Error('boom-test');
}
