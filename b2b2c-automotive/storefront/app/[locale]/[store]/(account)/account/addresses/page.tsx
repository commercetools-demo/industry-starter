// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AddressBook } from '@/components/account/AddressBook';
import { isAppLocale } from '@/i18n/config';

type Props = { params: Promise<{ locale: string; store: string }> };

/** Addresses (workstream Q-09): add, edit, delete, default (spec "Default address"). */
export default async function AddressesPage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <AddressBook />;
}
