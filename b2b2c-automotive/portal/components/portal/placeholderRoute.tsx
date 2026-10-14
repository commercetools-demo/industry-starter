/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import type { PortalAction } from '@/lib/authz/permissions';
import { viewerCan } from '@/lib/portal/viewer';
import { Forbidden } from './Forbidden';
import { PlaceholderPage } from './PlaceholderPage';

/**
 * Page body for a navigation route that a later workstream (S to W) replaces: the action decides on the server whether the
 * role may open it (a Buyer opening `/store` by URL gets the forbidden view, not the page). Never delete a route R created.
 */
export function placeholderRoute(titleKey: string, action: PortalAction) {
  return async function PlaceholderRoute({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    if (!(await viewerCan(action))) return <Forbidden />;
    return <PlaceholderPage titleKey={titleKey} />;
  };
}
