// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { AccountLink } from '@/components/shell/AccountLink';
import { CartButton } from '@/components/shell/CartButton';
import { SearchField } from '@/components/shell/SearchField';
import { StoreChip } from '@/components/shell/StoreChip';
import { Wordmark } from '@/components/shell/Wordmark';
// Slot for workstream J: the vehicle chip and garage menu. The import contract is `GarageChip` with no props.
import { GarageChip } from '@/components/vehicle/GarageChip';
import type { StoreSettings } from '@/lib/types';

/**
 * Header: wordmark, store chip, search, garage slot, account and cart. DOM (tab) order is the desktop order (one row from
 * `xl`); below that the rows are wordmark + account + cart, then the store chip and garage, then the search on its own row.
 */
export function Header({ store, settings, signedIn }: { store: string; settings: StoreSettings; signedIn: boolean }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 xl:flex-nowrap">
        <div className="order-1 w-full min-w-0 min-[34rem]:w-auto min-[34rem]:flex-1 xl:order-none xl:flex-none">
          <Wordmark store={store} settings={settings} />
        </div>
        <div className="order-4 w-full xl:order-none xl:w-auto">
          <StoreChip />
        </div>
        <div className="order-6 w-full xl:order-none xl:w-auto xl:min-w-0 xl:flex-1">
          <SearchField store={store} />
        </div>
        <div className="order-5 xl:order-none" data-slot="garage">
          <GarageChip />
        </div>
        <div className="order-2 xl:order-none">
          <AccountLink store={store} signedIn={signedIn} />
        </div>
        <div className="order-3 xl:order-none">
          <CartButton store={store} />
        </div>
      </div>
    </header>
  );
}
