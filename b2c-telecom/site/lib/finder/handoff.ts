import type { CartNotice } from '@/lib/types';
import type { Refusal } from './continue';

// What Continue leaves for /bundle to show once: the refused lines (named with their reasons) and the replacement notices. Kept in
// sessionStorage for the tab only; reading it removes it.

const KEY = 'malva-finder-handoff';

export interface Handoff {
  refused: Refusal[];
  notices: CartNotice[];
}

// `takeHandoff` reads storage once per write and keeps the answer, so a component can read it as an external store (stable snapshot).
let taken: Handoff | null | undefined;

export function writeHandoff(handoff: Handoff): void {
  taken = undefined;
  try {
    if (handoff.refused.length > 0 || handoff.notices.length > 0) sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // Storage blocked: the bundle still shows what was accepted.
  }
}

export function takeHandoff(): Handoff | null {
  if (taken !== undefined) return taken;
  taken = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<Handoff>;
    taken = { refused: Array.isArray(parsed.refused) ? parsed.refused : [], notices: Array.isArray(parsed.notices) ? parsed.notices : [] };
    return taken;
  } catch {
    return null;
  }
}
