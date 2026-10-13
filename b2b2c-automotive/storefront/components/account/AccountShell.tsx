// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/account/AccountMenu';

/** Two columns from 700 px (menu left, panels right); below that the menu is a select above the content. Not in the supplied designs: built from the kit's tokens. */
export function AccountShell({ store, showSubscriptions, children }: { store: string; showSubscriptions: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[43.75rem]:grid-cols-[14rem_1fr] min-[64rem]:p-5">
      <AccountMenu store={store} showSubscriptions={showSubscriptions} />
      <div className="grid min-w-0 content-start gap-5">{children}</div>
    </div>
  );
}
