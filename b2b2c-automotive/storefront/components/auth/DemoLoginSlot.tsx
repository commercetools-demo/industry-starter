// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// DOCUMENTED SLOT for the storefront demo login (`consumer-storefront/design-demo-login`, workstream Q-DEMO). The sign-in page renders this
// below the email and password form. Q replaces this body with the demo shopper picker (`DemoLogin`), which:
//   - lists the store's seeded demo shoppers from `GET /api/auth/demo-accounts` (404 when `DEMO_LOGIN_ENABLED` is not `true`);
//   - posts only the chosen customer id to `POST /api/auth/demo-login`, whose server handler calls `loginCustomer` from
//     `@/lib/auth/login` (the same function as the form route: anonymous cart merge, sign-in hooks, session) with the demo password
//     read from the server environment;
//   - goes to `next` (already validated with `safeNext`) afterwards.
// Until then nothing is rendered, so a production page has no trace of it.
import type { ReactNode } from 'react';

export interface DemoLoginSlotProps {
  /** The store of the page. */
  store: string;
  /** Validated return path inside the store (`/cart`); the form prefixes the store key. */
  next: string;
}

export function DemoLoginSlot(props: DemoLoginSlotProps): ReactNode {
  void props;
  return null;
}
