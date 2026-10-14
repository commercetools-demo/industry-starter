/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { NoAccess } from '@/components/auth/NoAccess';
import { Shell } from '@/components/layout/Shell';
import { redirect } from '@/i18n/routing';
import { isCopilotEnabled } from '@/lib/portal/flags';
import { getPortalSession, getViewer, isSignedIn } from '@/lib/portal/viewer';

// Every page of this group reads the session cookie, so it is rendered per request and never cached
// (Next sends `Cache-Control: private, no-cache, no-store` for dynamic responses).
export default async function PortalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getPortalSession();
  // redirect() throws on purpose: never wrapped in try/catch. The proxy adds `?next=` for deep links (R-17).
  if (!session.customerId) redirect({ href: '/sign-in', locale });
  if (!isSignedIn(session) || !session.businessUnitKey) redirect({ href: '/pending-approval', locale });
  const viewer = await getViewer();
  if (!viewer || viewer.roles.length === 0) return <NoAccess />;
  return <Shell viewer={viewer} copilot={isCopilotEnabled()}>{children}</Shell>;
}
