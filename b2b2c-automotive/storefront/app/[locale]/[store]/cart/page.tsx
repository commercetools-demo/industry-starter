// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CartPage } from '@/components/cart/CartPage';
import { CartProvider } from '@/context/CartProvider';
import { isAppLocale } from '@/i18n/config';
import { loadCartView } from '@/lib/ct/cart-view';
import { getSession } from '@/lib/session';
import { getActiveVehicle } from '@/lib/vehicles/active';

type Props = { params: Promise<{ locale: string; store: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * The cart of the shopper (workstream N, design view `cart`). Dynamic: it reads the session cart. The cart is read on the server for the
 * first paint and handed to the client (`CartProvider`), so the page does not flash empty. A session cart that is gone, not Active or of
 * another store leaves the client to fetch (`GET /api/cart` clears the stale id from the cookie, which a Server Component cannot).
 */
export default async function Page({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [session, vehicle, t] = await Promise.all([getSession(), getActiveVehicle().catch(() => null), getTranslations({ locale, namespace: 'cart' })]);

  let initialCart: Awaited<ReturnType<typeof loadCartView>>['cart'] | undefined = null;
  if (session.cartId) {
    try {
      const { cart, drop } = await loadCartView(session.cartId, {
        storeKey: store,
        locale,
        branchKey: session.branchKey,
        vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine } : null,
        savingFallback: t('savingFallback'),
      });
      initialCart = drop ? undefined : cart;
    } catch {
      initialCart = undefined; // the client reads it and shows the error state of the cart itself
    }
  }

  return (
    <CartProvider initialCart={initialCart}>
      <CartPage store={store} />
    </CartProvider>
  );
}
