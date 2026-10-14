/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { redirect } from '@/i18n/routing';

// Content opens on its Pages tab. The layout has already refused a role that may not view content.
export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/content/pages', locale });
}
