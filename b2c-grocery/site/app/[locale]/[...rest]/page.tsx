/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { notFound } from 'next/navigation';

/** Unmatched URLs under a valid locale render the localized not-found page. */
export default function CatchAllPage(): never {
  notFound();
}
