'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The keyboard pattern of a tab strip that switches content on the page (WAI-ARIA tabs, workstream Y K10): one tab stop (the selected tab),
// Left and Right (wrapping), Home and End move and select, disabled tabs are skipped; tab and panel ids are linked.
import { useId, useRef, type KeyboardEvent } from 'react';

export function useTablist<T extends string>({
  ids,
  value,
  onChange,
  idBase,
  isDisabled,
  withPanel = true,
}: {
  ids: readonly T[];
  value: T;
  onChange: (id: T) => void;
  idBase?: string;
  isDisabled?: (id: T) => boolean;
  /** False when the tabs filter content that is not wrapped in a tabpanel: no aria-controls is set then. */
  withPanel?: boolean;
}) {
  const generated = useId();
  const base = idBase ?? generated;
  const refs = useRef(new Map<T, HTMLElement | null>());
  const tabId = (id: T) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const enabled = ids.filter((id) => !isDisabled?.(id));
    if (enabled.length === 0) return;
    const index = enabled.indexOf(value);
    let next: T | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    refs.current.get(next)?.focus();
  };

  return {
    /** Spread on the element with role="tablist". */
    listProps: { onKeyDown },
    /** Spread on each tab button. */
    tabProps: (id: T) => ({
      ref: (el: HTMLElement | null) => {
        refs.current.set(id, el);
      },
      id: tabId(id),
      role: 'tab' as const,
      'aria-selected': value === id,
      ...(withPanel ? { 'aria-controls': panelId } : {}),
      tabIndex: value === id ? 0 : -1,
      onClick: () => onChange(id),
    }),
    /** Spread on the panel that shows the selected tab's content. */
    panelProps: () => ({ id: panelId, role: 'tabpanel' as const, 'aria-labelledby': tabId(value) }),
  };
}
