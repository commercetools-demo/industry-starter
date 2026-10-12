// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckoutErrorReason, CheckoutSessionResult } from '@/lib/types';

export type CheckoutSessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: CheckoutSessionResult }
  | { status: 'error'; reason: CheckoutErrorReason; lineItemIds: string[] };

const REASONS: Record<string, CheckoutErrorReason> = {
  'cart-missing': 'cart-missing',
  'cart-empty': 'cart-empty',
  'lines-unavailable': 'lines-unavailable',
  'subscriptions-unavailable': 'subscriptions-unavailable',
  'checkout-not-configured': 'not-configured',
};

async function createSession(): Promise<CheckoutSessionState> {
  try {
    const res = await fetch('/api/checkout/session', { method: 'POST', credentials: 'same-origin' });
    const body = (await res.json().catch(() => null)) as { sessionId?: string; projectKey?: string; region?: string; error?: string; lineItemIds?: string[] } | null;
    if (res.ok && body?.sessionId && body.projectKey && body.region) return { status: 'ready', session: { sessionId: body.sessionId, projectKey: body.projectKey, region: body.region } };
    return { status: 'error', reason: REASONS[body?.error ?? ''] ?? 'unavailable', lineItemIds: body?.lineItemIds ?? [] };
  } catch {
    return { status: 'error', reason: 'unavailable', lineItemIds: [] };
  }
}

/**
 * Creates the Checkout session once when the page mounts (a ref guards the double effect of Strict Mode) and again on `retry`:
 * sessions expire, so a new one is created as late as possible, never cached.
 */
export function useCheckoutSession(): { state: CheckoutSessionState; retry: () => void } {
  const [state, setState] = useState<CheckoutSessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (startedFor.current === attempt) return;
    startedFor.current = attempt;
    // No cleanup on purpose: Strict Mode runs this effect twice with the same attempt, the ref stops the second run, and the first
    // answer still lands in the preserved state. Setting state after a real unmount is harmless in React 19.
    void createSession().then((next) => setState((current) => (startedFor.current === attempt ? next : current)));
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
