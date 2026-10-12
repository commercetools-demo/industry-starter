// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';
import { isAppLocale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { checkoutEnvSafe } from '@/lib/checkout/env';
import { loadCartView } from '@/lib/ct/cart-view';
import { getShellContext } from '@/lib/ct/shell';
import { getSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';
import { getActiveVehicle } from '@/lib/vehicles/active';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; store: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * Checkout (workstream O). Guards on the server: a missing or empty cart, or a line nothing can supply (the cart blocks its own button
 * for it), goes back to the cart. Guests and signed-in shoppers both reach it. The page never creates the Checkout session; the widget
 * asks the BFF when it mounts, as late as possible, because sessions expire.
 */
export default async function Page({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const query = await searchParams;
  const [session, vehicle, ctx, cartT] = await Promise.all([
    getSession(),
    getActiveVehicle().catch(() => null),
    getShellContext(store, locale),
    getTranslations({ locale, namespace: 'cart' }),
  ]);
  if (!ctx) notFound();

  const back = () => redirect({ href: `/${store}/cart`, locale });
  if (!session.cartId) back();
  const { cart } = await loadCartView(session.cartId, {
    storeKey: store,
    locale,
    branchKey: session.branchKey,
    vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine } : null,
    savingFallback: cartT('savingFallback'),
  }).catch(() => ({ cart: null }));
  if (!cart || cart.lines.length === 0 || cart.lines.some((line) => line.stock.available === 0)) back();

  const scope = getBranchScope({ branchKey: session.branchKey }, ctx.branches, ctx.retailChannelId);
  const branch = ctx.branches.find((b) => b.key === scope.branchKey);
  const pickup = cart?.delivery.selected === 'pickup' && branch ? { branchName: branch.name, address: branch.address, hours: branch.hours } : null;

  const env = checkoutEnvSafe();
  const devComplete = env.devComplete && (!env.applicationKey || query.dev === '1');

  return <CheckoutPage store={store} pickup={pickup} cancelled={query.status === 'cancelled'} devComplete={devComplete} />;
}
