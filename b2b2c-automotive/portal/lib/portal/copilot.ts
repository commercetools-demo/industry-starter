// Copilot that asks before changing (R-16). Deterministic rules, no LLM (Q-R03): a registry of actions plus built-in
// "where is X" answers. `plan` never changes anything; only `applyConfirmed` (called by POST /api/copilot/apply after the
// user pressed Confirm) runs an action, and it re-checks the permission. T registers `set-discount-active` in T-14.
import { createTranslator } from 'next-intl';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { can, type PortalAction, type PortalPermissions } from '@/lib/authz/permissions';
import { visibleItems } from './nav';
import type { PortalSession } from './types';

export interface CopilotAction {
  id: string;
  match(text: string): { params: Record<string, string> } | null;
  /** The exact change in words, e.g. Set 'Brake season promo' to inactive. */
  describe(params: Record<string, string>): string;
  apply(session: PortalSession, params: Record<string, string>): Promise<{ ok: boolean; message: string }>;
  permission: PortalAction;
}

export type CopilotPlan =
  | { kind: 'answer'; text: string; href?: string }
  | { kind: 'confirm'; actionId: string; params: Record<string, string>; summary: string };

const registry: CopilotAction[] = [];

export function registerCopilotAction(action: CopilotAction): void {
  const index = registry.findIndex((a) => a.id === action.id);
  if (index >= 0) registry[index] = action;
  else registry.push(action);
}

/** Test helper: empties the registry. */
export function resetCopilotActions(): void {
  registry.length = 0;
}

const catalogs = { 'de-DE': de, 'en-US': en } as const;
type Locale = keyof typeof catalogs;
const translator = (locale: Locale) => createTranslator({ locale, messages: catalogs[locale] });
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const lookup = (catalog: unknown, path: string): string => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], catalog) as string;

/** "where is X" / "wo ist X": the page whose label (in either language) appears in X, among the pages the role may open. */
function whereIs(text: string, perms: PortalPermissions, locale: Locale): CopilotPlan | null {
  const m = /^\s*(?:where\s+(?:is|are|can i find)|wo\s+(?:ist|sind|finde ich))\s+(?:the\s+|die\s+|der\s+|das\s+)?(.+?)\s*\??\s*$/i.exec(text);
  if (!m) return null;
  const wanted = fold(m[1]);
  const item = visibleItems(perms.roles).find((i) => [de, en].some((c) => fold(lookup(c, i.labelKey)) === wanted || wanted.includes(fold(lookup(c, i.labelKey)))));
  if (!item) return null;
  const t = translator(locale);
  return { kind: 'answer', text: t('copilot.whereIs', { page: lookup(catalogs[locale], item.labelKey) }), href: item.href };
}

export function plan(text: string, session: PortalSession, perms: PortalPermissions, locale: Locale = 'en-US'): CopilotPlan {
  void session;
  const t = translator(locale);
  for (const action of registry) {
    const match = action.match(text);
    if (!match) continue;
    if (!can(perms, action.permission)) return { kind: 'answer', text: t('copilot.refused') };
    return { kind: 'confirm', actionId: action.id, params: match.params, summary: action.describe(match.params) };
  }
  return whereIs(text, perms, locale) ?? { kind: 'answer', text: t('copilot.fallback') };
}

/** Runs a confirmed action after re-checking the permission. Failures never leak details. */
export async function applyConfirmed(
  actionId: string,
  params: Record<string, string>,
  session: PortalSession,
  perms: PortalPermissions,
): Promise<{ ok: boolean; message: string }> {
  const action = registry.find((a) => a.id === actionId);
  if (!action) return { ok: false, message: 'Unknown action' };
  if (!can(perms, action.permission)) return { ok: false, message: 'Insufficient permissions to perform this task' };
  try {
    return await action.apply(session, params);
  } catch {
    return { ok: false, message: 'Something went wrong' };
  }
}
