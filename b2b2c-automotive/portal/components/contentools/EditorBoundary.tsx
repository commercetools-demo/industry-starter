'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The boundary the Contentools managers are mounted in (workstream U-03, decision 15). The managers ship their own Nimbus
// provider and hard-coded colours, so the boundary gives them a light surface (also in the portal's dark theme), a stacking
// context and a definite height (they render `height: 100%` flex columns and collapse without one).
// With `presets` it also marks the ThemeManager presets the storefront does not honour (decision 5).
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UNSUPPORTED_PRESET_KEYS } from './theme-support';

const SELECT_WAIT_MS = 3000;
const PRESET_SELECT = 'select#theme-preset-select';

/** Disables and suffixes the unsupported options; idempotent. Returns false while the select does not exist yet. */
export function markUnsupportedPresets(root: ParentNode, suffix: string, unsupported: readonly string[] = UNSUPPORTED_PRESET_KEYS): boolean {
  const select = root.querySelector<HTMLSelectElement>(PRESET_SELECT);
  if (!select) return false;
  for (const option of Array.from(select.options)) {
    if (!unsupported.includes(option.value)) continue;
    if (!option.disabled) option.disabled = true;
    if (!option.text.endsWith(suffix)) option.text = `${option.text}${suffix}`;
  }
  return true;
}

export function EditorBoundary({ children, presets = false }: { children: ReactNode; presets?: boolean }) {
  const t = useTranslations('contentools');
  const ref = useRef<HTMLDivElement>(null);
  const [selectMissing, setSelectMissing] = useState(false);
  const suffix = t('unsupportedSuffix');

  useEffect(() => {
    const root = ref.current;
    if (!presets || !root) return;
    let found = markUnsupportedPresets(root, suffix);
    const observer = new MutationObserver(() => {
      if (markUnsupportedPresets(root, suffix)) found = true;
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    // The select appears only after the editor has loaded; if it never does, say so instead of failing silently.
    const timer = setTimeout(() => {
      if (!found) setSelectMissing(true);
    }, SELECT_WAIT_MS);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [presets, suffix]);

  return (
    <div data-theme="light" ref={ref} className="relative isolate overflow-auto rounded-200 bg-gray-1 text-gray-15 scheme-light" style={{ minHeight: 'calc(100vh - 16rem)' }}>
      {presets && selectMissing ? (
        <p role="note" className="m-300 rounded-300 bg-bg-info-subdued px-300 py-250 text-body-2 font-semibold text-gray-15">
          {t('presetNotice', { list: UNSUPPORTED_PRESET_KEYS.join(', ') })}
        </p>
      ) : null}
      {children}
    </div>
  );
}
