// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { StorePicker } from '@/components/store-picker/StorePicker';
import { StorePickerContext } from '@/context/StorePickerContext';
import { useBranches } from '@/hooks/useBranches';
import { keyBranches } from '@/lib/cache-keys';
import type { BranchesResponse } from '@/lib/types';

export const PICKER_DISMISSED_KEY = 'picker-dismissed';

interface Props {
  /** The branches as the server computed them: seeds the cache so the chip has data on the first render. */
  initial: BranchesResponse;
  children: ReactNode;
}

/**
 * Wraps the shell and the page. Provides `useStorePicker()`, renders the picker, and opens it by itself once when the shopper
 * has not chosen a branch, the store has more than one, and it was not dismissed in this tab.
 */
export function StorePickerHost({ initial, children }: Props) {
  const locale = useLocale();
  return (
    <SWRConfig value={{ fallback: { [keyBranches(locale)]: initial } }}>
      <Host>{children}</Host>
    </SWRConfig>
  );
}

function Host({ children }: { children: ReactNode }) {
  const { data } = useBranches();
  const [isOpen, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const multiple = Boolean(data && !data.single && data.branches.length > 1);

  useEffect(() => {
    if (autoOpened.current || !data || !multiple || data.chosen) return;
    autoOpened.current = true;
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(PICKER_DISMISSED_KEY) !== null;
    } catch {
      dismissed = false; // storage blocked: still open once
    }
    // sessionStorage exists only in the browser, so the first-visit decision can only be taken after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dismissed) setOpen(true);
  }, [data, multiple]);

  const open = useCallback(() => {
    if (multiple) setOpen(true);
  }, [multiple]);
  const close = useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(PICKER_DISMISSED_KEY, '1');
    } catch {
      // storage blocked: the picker may open again on the next page load
    }
  }, []);
  const api = useMemo(() => ({ open, isOpen }), [open, isOpen]);

  return (
    <StorePickerContext.Provider value={api}>
      {children}
      {data && multiple ? <StorePicker open={isOpen} onClose={close} data={data} /> : null}
    </StorePickerContext.Provider>
  );
}
