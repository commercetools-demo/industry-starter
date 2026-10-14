/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { jsonLdString } from '@/components/service/seo';
import { EMERGENCY_HREF } from '@/lib/site';
import { organizationJsonLd } from '@/lib/seo';

/** Organization structured data for every page. Static: no session, no sample content. */
export function OrganizationJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd(EMERGENCY_HREF.replace('tel:', ''))) }} />;
}
