/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { notFound } from 'next/navigation';

// Catch-all: an unmatched /<locale>/... address renders `../not-found.tsx` inside the shell with a
// 404 status, instead of Next's default 404 without the header and footer.
export default function CatchAll(): never {
  notFound();
}
