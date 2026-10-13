// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PaymentMethodsPanel } from '@/components/account/PaymentMethodsPanel';
import { isAppLocale } from '@/i18n/config';

type Props = { params: Promise<{ locale: string; store: string }> };

/** Saved payment methods (workstream Q-10): tokenised, delete only; methods are saved inside the hosted Checkout. */
export default async function PaymentMethodsPage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <PaymentMethodsPanel />;
}
