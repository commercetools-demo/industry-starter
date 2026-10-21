'use client';

import AccountMenu from '@/components/layout/AccountMenu';
import CartButton from '@/components/layout/CartButton';
import LocalePill from '@/components/layout/LocalePill';
import SearchToggle from '@/components/layout/SearchToggle';
import StorePill from '@/components/layout/StorePill';

/** Right side of the header, right to left: store pill, locale pill, search, account, cart. */
export default function HeaderActions() {
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <StorePill />
      <LocalePill />
      <SearchToggle />
      <AccountMenu />
      <CartButton />
    </div>
  );
}
