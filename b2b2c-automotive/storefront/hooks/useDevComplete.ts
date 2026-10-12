// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useState } from 'react';

/** DEV ONLY (O-08): asks the completion route for a test order without payment, then follows the return URL it answers. */
export function useDevComplete(navigate: (path: string) => void = (path) => window.location.assign(path)) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function complete(customerEmail: string): Promise<void> {
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch('/api/dev/checkout/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerEmail }),
      });
      const body = (await res.json().catch(() => null)) as { redirect?: unknown } | null;
      if (res.ok && typeof body?.redirect === 'string' && body.redirect.startsWith('/checkout/return?orderId=')) {
        navigate(body.redirect);
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return { complete, pending, failed };
}
