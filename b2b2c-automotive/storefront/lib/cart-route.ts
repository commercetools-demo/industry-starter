// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shared plumbing of the cart routes and the cart page (workstream N-09): the session's store, locale and branch, the active vehicle, the
// session cart and the JSON answer. Handlers stay thin: validate, call `lib/ct`, answer `{ cart }`.
import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/config';
import { ApiError } from '@/lib/api';
import type { CartViewInput } from '@/lib/ct/cart-view';
import { getLocale, getSession, updateSession } from '@/lib/session';
import type { CartResponse, Session } from '@/lib/types';
import { getActiveVehicle } from '@/lib/vehicles/active';

export interface CartRouteContext {
  session: Session & { storeKey: string };
  locale: AppLocale;
  view: CartViewInput;
}

/** The store, locale, branch and vehicle of the request. 404 when the session has no store (the proxy always writes one for a store page). */
export async function cartRouteContext(): Promise<CartRouteContext> {
  const session = await getSession();
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const { locale } = await getLocale();
  const [vehicle, t] = await Promise.all([getActiveVehicle().catch(() => null), getTranslations({ locale, namespace: 'cart' })]);
  return {
    session: { ...session, storeKey: session.storeKey },
    locale,
    view: {
      storeKey: session.storeKey,
      locale,
      branchKey: session.branchKey,
      vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine } : null,
      savingFallback: t('savingFallback'),
    },
  };
}

/** Runs a write on the session's cart. A cart that is gone or belongs to another store (the in-store endpoint answers 404) is removed from the session. */
export async function withSessionCart<T>(context: CartRouteContext, fn: (cartId: string) => Promise<T>): Promise<T> {
  const cartId = context.session.cartId;
  if (!cartId) throw new ApiError(404, 'Not found');
  try {
    return await fn(cartId);
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
    if (status === 404) await dropSessionCart();
    throw error;
  }
}

/** Removes the cart id from the session cookie. */
export const dropSessionCart = (): Promise<Session> =>
  updateSession((s) => {
    const next = { ...s };
    delete next.cartId;
    return next;
  });

export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export const cartJson = (body: CartResponse, init?: ResponseInit): Response => Response.json(body, { ...init, headers: { ...NO_STORE, ...init?.headers } });
