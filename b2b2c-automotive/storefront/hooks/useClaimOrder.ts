// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_SUMMARY, KEY_GARAGE } from '@/lib/cache-keys';

export type ClaimError = 'too-short' | 'too-common' | 'failed' | 'rate-limited';
export type ClaimResult = { ok: true } | { ok: false; error: ClaimError };

interface ClaimInput {
  orderNumber: string;
  store: string;
  password: string;
  /** The private link token of the page, when the shopper came through it. */
  token?: string;
}

/**
 * Guest "Create account" of the confirmation page: `POST /api/orders/{number}/claim`. The server creates the customer with the order's
 * email, attaches the order and signs the shopper in; afterwards everything that depends on who is signed in is refreshed. Never throws.
 * The password is sent once and never stored.
 */
export function useClaimOrder() {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);

  const claim = useCallback(
    async ({ orderNumber, store, password, token }: ClaimInput): Promise<ClaimResult> => {
      setPending(true);
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/claim`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ store, password, ...(token ? { token } : {}) }),
        });
        if (res.ok) {
          await Promise.all([mutate(KEY_ACCOUNT), mutate(KEY_GARAGE), mutate(KEY_CART_SUMMARY), mutate((key) => typeof key === 'string' && key.startsWith(KEY_CART))]);
          return { ok: true };
        }
        const body = (await res.json().catch(() => null)) as { error?: string; rule?: string } | null;
        if (res.status === 429) return { ok: false, error: 'rate-limited' };
        if (res.status === 400 && body?.error === 'password') return { ok: false, error: body.rule === 'too-common' ? 'too-common' : 'too-short' };
        return { ok: false, error: 'failed' };
      } catch {
        return { ok: false, error: 'failed' };
      } finally {
        setPending(false);
      }
    },
    [mutate],
  );

  return { claim, pending };
}
