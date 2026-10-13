// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The storefront demo login slot (`consumer-storefront/design-demo-login`, workstream Q-13a). The sign-in page renders this below the email and
// password form. It renders the demo shopper picker (`DemoLogin`) only when `DEMO_LOGIN_ENABLED=true` outside production, decided on the server:
// a page without the flag has no trace of the control and `GET /api/auth/demo-accounts` answers 404.
import type { ReactNode } from 'react';
import { DemoLogin } from '@/components/account/DemoLogin';
import { isDemoLoginEnabled } from '@/lib/demo-login';

export interface DemoLoginSlotProps {
  /** The store of the page. */
  store: string;
  /** Validated return path inside the store (`/cart`); the form prefixes the store key. */
  next: string;
}

export function DemoLoginSlot({ store, next }: DemoLoginSlotProps): ReactNode {
  return isDemoLoginEnabled() ? <DemoLogin store={store} next={next} /> : null;
}
