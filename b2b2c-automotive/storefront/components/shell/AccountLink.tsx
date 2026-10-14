// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * "Sign in" or "Account". `signedIn` comes from the session on the server (the layout), so there is no flash of the wrong label.
 * Both go to the account area, which asks a signed-out shopper to sign in (workstream P).
 */
export function AccountLink({ store, signedIn }: { store: string; signedIn: boolean }) {
  const t = useTranslations('shell.account');
  return (
    <Link href={`/${store}/account`} className="inline-flex min-h-7 items-center px-2 font-utility text-sm text-text-link hover:underline">
      {signedIn ? t('account') : t('signIn')}
    </Link>
  );
}
