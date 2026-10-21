'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import Icon from '@/components/ui/Icon';
import type { DroppedLine } from '@/lib/types';

/** sessionStorage key written by `useMarket` after a region switch that could not move every line. */
export const DROPPED_LINES_KEY = 'mcf-dropped-lines';
const CHANGE_EVENT = 'mcf-dropped-lines-change';

/** Remembers the lines a region switch could not move until the shopper dismisses the notice. */
export function storeDroppedLines(lines: DroppedLine[]): void {
  try {
    if (lines.length > 0) sessionStorage.setItem(DROPPED_LINES_KEY, JSON.stringify(lines));
    else sessionStorage.removeItem(DROPPED_LINES_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // storage unavailable: no notice, the switch itself still worked
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const snapshot = (): string => {
  try {
    return sessionStorage.getItem(DROPPED_LINES_KEY) ?? '';
  } catch {
    return '';
  }
};

function parse(raw: string): DroppedLine[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed.filter((d) => d && typeof d.name === 'string') as DroppedLine[]) : [];
  } catch {
    return [];
  }
}

/**
 * "{n} items could not be moved to your new region: {names}". Stays until dismissed: the list lives in sessionStorage, so
 * it survives the navigation that follows a region switch.
 */
export default function DroppedLinesNotice() {
  const t = useTranslations('cart.dropped');
  const raw = useSyncExternalStore(subscribe, snapshot, () => '');
  const lines = useMemo(() => parse(raw), [raw]);
  const dismiss = useCallback(() => storeDroppedLines([]), []);
  if (lines.length === 0) return null;
  return (
    <div role="status" data-testid="dropped-lines" className="mb-4 flex items-start gap-3 rounded-field bg-amber/25 px-4 py-3 text-[13px] text-ink">
      <Icon name="clock" size={16} className="mt-0.5 shrink-0" />
      <p className="m-0 flex-1">{t('title', { count: lines.length, names: lines.map((l) => l.name).join(', ') })}</p>
      <button type="button" onClick={dismiss} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold underline underline-offset-2">
        {t('dismiss')}
      </button>
    </div>
  );
}
