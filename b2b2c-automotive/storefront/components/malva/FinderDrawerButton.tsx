// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The "Find your reseller" button of the Malva header: opens the finder drawer without a product (the reseller's home opens on choice)
// and hands the button over as the opener, so closing the drawer returns focus to it.
import { Button } from '@/components/ui/Button';
import { useFinderDrawer } from '@/components/malva/FinderDrawerProvider';

export function FinderDrawerButton({ label }: { label: string }) {
  const drawer = useFinderDrawer();
  return (
    <Button variant="primary" aria-haspopup="dialog" aria-expanded={drawer.isOpen} onClick={(event) => drawer.open({ opener: event.currentTarget })}>
      {label}
    </Button>
  );
}
