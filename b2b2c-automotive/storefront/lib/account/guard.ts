// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Server-side guard of the account area (workstream Q-01, D2): a request without a signed-in customer goes to sign-in with the page it wanted as
// `next` (locale-less, store-relative, checked by `safeNext`). The proxy passes the request path as `x-pathname`.
import 'server-only';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/routing';
import { safeNext } from '@/lib/auth/safe-next';
import { getSession } from '@/lib/session';
import type { Session } from '@/lib/types';

/** `/en-US/mau-store/account/orders?page=2` to `/account/orders?page=2`; anything unexpected is `/account`. */
export function nextPathOf(requestPath: string | null, locale: string, store: string): string {
  const prefix = `/${locale}/${store}`;
  if (!requestPath?.startsWith(`${prefix}/`)) return '/account';
  return safeNext(requestPath.slice(prefix.length), '/account');
}

/** The session of a signed-in customer, or a redirect to sign-in. */
export async function requireSignedIn(locale: string, store: string): Promise<Session & { customerId: string }> {
  const session = await getSession();
  if (!session.customerId) {
    const next = nextPathOf((await headers()).get('x-pathname'), locale, store);
    redirect({ href: `/${store}/account/sign-in?next=${encodeURIComponent(next)}`, locale });
  }
  return session as Session & { customerId: string };
}
