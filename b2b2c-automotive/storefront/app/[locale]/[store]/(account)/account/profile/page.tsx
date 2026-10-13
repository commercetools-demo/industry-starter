// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DeleteAccountPanel } from '@/components/account/DeleteAccountPanel';
import { PasswordForm } from '@/components/account/PasswordForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { isAppLocale } from '@/i18n/config';
import { accountPageTitle } from '@/lib/account/page-title';

type Props = { params: Promise<{ locale: string; store: string }> };

export const generateMetadata = accountPageTitle('profile');

/** Profile and security (workstream Q-11): details, consent, email, password and delete account. */
export default async function ProfilePage({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <div className="grid gap-5">
      <ProfileForm />
      <PasswordForm />
      <DeleteAccountPanel store={store} />
    </div>
  );
}
