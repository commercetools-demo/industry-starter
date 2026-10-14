/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactElement } from 'react';
import { serializeJsonLd } from '@/lib/content/jsonld';

/** Structured data for search engines; the data comes from repo-authored content only. */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
