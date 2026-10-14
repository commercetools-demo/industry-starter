// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Every cart write of workstream N goes through `withCartRetry` (D9): load the cart, run the write on its version, and on a
// 409 reload (never reuse the failed version) and run again, up to `attempts` times.
import 'server-only';
import type { Cart } from '@commercetools/platform-sdk';
import { inStore } from '@/lib/ct/in-store';

export const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

export async function withCartRetry<T>(storeKey: string, cartId: string, fn: (cart: Cart) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).get().execute();
    try {
      return await fn(body);
    } catch (error) {
      if (statusOf(error) !== 409) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
