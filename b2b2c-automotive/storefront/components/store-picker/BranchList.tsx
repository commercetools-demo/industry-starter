// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import { BranchRow } from '@/components/store-picker/BranchRow';
import type { BranchRowData } from '@/lib/store/branch-search';

interface Props {
  rows: BranchRowData[];
  focusedKey: string | null;
  currentKey: string;
  busy: boolean;
  onFocus: (key: string) => void;
  onChoose: (key: string) => void;
}

/**
 * The primary control of the picker: a listbox with `aria-activedescendant`. Arrow keys, Home and End move the focused row,
 * Enter moves keyboard focus to that row's "Shop at this store" button. The map is an enhancement of this list.
 */
export function BranchList({ rows, focusedKey, currentKey, busy, onFocus, onChoose }: Props) {
  const t = useTranslations('storePicker');
  const prefix = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const optionId = (key: string) => `${prefix}-${key}`;

  if (rows.length === 0) {
    return (
      <p role="status" className="p-3 font-ui text-sm text-text-muted">
        {t('noMatch')}
      </p>
    );
  }

  const index = rows.findIndex((r) => r.branch.key === focusedKey);
  const move = (to: number) => onFocus(rows[Math.min(rows.length - 1, Math.max(0, to))].branch.key);

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={t('listLabel')}
      aria-activedescendant={index >= 0 ? optionId(rows[index].branch.key) : undefined}
      className="flex flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(index + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(index <= 0 ? 0 : index - 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          move(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          move(rows.length - 1);
        } else if (event.key === 'Enter' && index >= 0) {
          event.preventDefault();
          listRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        }
      }}
    >
      {rows.map(({ branch, distanceKm }) => (
        <BranchRow
          key={branch.key}
          branch={branch}
          distanceKm={distanceKm}
          focused={branch.key === focusedKey}
          current={branch.key === currentKey}
          busy={busy}
          optionId={optionId(branch.key)}
          onFocus={() => {
            onFocus(branch.key);
            listRef.current?.focus();
          }}
          onChoose={() => onChoose(branch.key)}
        />
      ))}
    </div>
  );
}
