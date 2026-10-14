// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GaragePanel } from '@/components/account/GaragePanel';
import { isAppLocale } from '@/i18n/config';
import { accountPageTitle } from '@/lib/account/page-title';

type Props = { params: Promise<{ locale: string; store: string }> };

export const generateMetadata = accountPageTitle('garage');

/** Garage (workstream Q-08). The garage itself is workstream J's (`useGarage`, the `malva-customer.garage` field); this page only manages it. */
export default async function GaragePage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <GaragePanel />;
}
