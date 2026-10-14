/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useRouter } from '@/i18n/routing';
import { useOverlay } from '@/context/OverlayContext';
import { usePalette } from '@/context/PaletteContext';
import { useViewer } from '@/context/ViewerContext';
import { usePartSearch } from '@/hooks/usePartSearch';
import { usePermissions } from '@/hooks/usePermissions';
import { visibleItems } from '@/lib/portal/nav';
import { catalogHref } from '@/lib/portal/search';

interface Entry {
  id: string;
  label: string;
  kind: string;
  href: string;
}

/** Cmd+K or Ctrl+K toggles the palette; the field shortcuts live here so one listener owns them. */
export function useCommandPaletteShortcut() {
  const overlay = useOverlay();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        overlay.toggle('cmd');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay]);
}

/**
 * Pages from the navigation the role may see, plus parts after two characters (200 ms debounce). Arrow keys move,
 * Enter opens, Escape closes (the overlay stack).
 */
export function CommandPalette() {
  const t = useTranslations('palette');
  const nav = useTranslations();
  const viewer = useViewer();
  const { roles } = usePermissions();
  const overlay = useOverlay();
  const router = useRouter();
  const { query, setQuery } = usePalette();
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const listId = useId();
  const open = overlay.isOpen('cmd');
  useFocusTrap(dialog, open);
  const parts = usePartSearch(open ? query : '', viewer.storeKey);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = visibleItems(roles)
      .map((item) => ({ id: `page-${item.id}`, label: nav(item.labelKey), kind: t('page'), href: item.href }))
      .filter((entry) => !q || entry.label.toLowerCase().includes(q))
      .slice(0, q ? 4 : 6);
    const hits = parts.map((p) => ({ id: `part-${p.sku}`, label: p.name, kind: p.sku, href: catalogHref(p.sku) }));
    return [...pages, ...hits];
  }, [query, roles, parts, nav, t]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const current = Math.min(active, Math.max(entries.length - 1, 0));

  if (!open) return null;

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    overlay.close('cmd');
    setQuery('');
    router.push(entry.href);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={() => overlay.close('cmd')} className="absolute inset-0 bg-overlay" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="absolute left-1/2 top-2400 z-60 flex w-full max-w-widget-desktop-8col -translate-x-1/2 flex-col gap-200 rounded-400 bg-bg-surface p-400 text-text shadow-popover narrow:top-1600"
      >
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={entries[current] ? `${listId}-${entries[current].id}` : undefined}
          aria-label={t('title')}
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive(Math.min(current + 1, entries.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive(Math.max(current - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(entries[current]);
            }
          }}
          className="h-1100 w-full rounded-300 border border-border-input bg-bg-surface px-300 text-body-1 font-semibold text-text"
        />
        <ul id={listId} role="listbox" aria-label={t('title')} className="flex flex-col gap-050">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              id={`${listId}-${entry.id}`}
              role="option"
              aria-selected={index === current}
              onMouseMove={() => setActive(index)}
              onClick={() => go(entry)}
              className={`flex min-h-1100 cursor-pointer items-center justify-between gap-200 rounded-300 px-300 text-body-1 font-semibold ${index === current ? 'bg-bg-surface-hover' : ''}`}
            >
              <span>{entry.label}</span>
              <span className="text-caption-1 font-medium text-text-subdued">{entry.kind}</span>
            </li>
          ))}
        </ul>
        {entries.length === 0 ? (
          <p role="status" className="px-300 py-200 text-caption-1 text-text-subdued">
            {t('empty')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
