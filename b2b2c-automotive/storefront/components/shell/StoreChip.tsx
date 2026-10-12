// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useStorePicker } from '@/context/StorePickerContext';
import { useBranches } from '@/hooks/useBranches';

/** "Your store" chip: the chosen branch's name and city, and a Change control that opens the picker. Renders nothing for a single branch. */
export function StoreChip() {
  const t = useTranslations('shell.storeChip');
  const { data } = useBranches();
  const { open } = useStorePicker();
  if (!data || data.single) return null;
  const branch = data.branches.find((b) => b.key === data.selectedKey) ?? data.branches[0];
  if (!branch) return null;
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className="flex min-h-7 w-fit max-w-full items-center gap-3 rounded-sm bg-surface-quiet px-3 text-left hover:bg-surface-subtle"
    >
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-action ring-4 ring-action-subtle" />
      <span className="flex flex-col leading-tight">
        <span className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{t('label')}</span>
        <span className="font-display text-sm font-medium text-text">
          {branch.name}, {branch.address.city}
        </span>
      </span>
      <span className="font-utility text-sm text-text-link underline underline-offset-2">{t('change')}</span>
    </button>
  );
}
