// Renders the SPIKE-L block of plan/PROJECT-FINDINGS.md. Only whitelisted facts; secrets are redacted defensively.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Decision } from './decide';
import type { ProbeResult } from './probe';

export const SPIKE_BEGIN = '<!-- SPIKE-L:BEGIN -->';
export const SPIKE_END = '<!-- SPIKE-L:END -->';

export interface FindingsExtras {
  acceptedAction?: string;
  mixAccepted: 'yes' | 'no' | 'unknown';
  grouping?: string;
  openItems: string[];
}

const SECRET_NAME = /SECRET|TOKEN|PASSWORD|CLIENT_ID|PRIVATE/i;

/** Removes bearer tokens and the value of every secret-looking environment variable. */
export function redact(text: string, env: Record<string, string | undefined> = process.env): string {
  let out = text.replace(/Bearer\s+\S+/gi, '[redacted]');
  for (const [name, value] of Object.entries(env)) {
    if (value && value.length >= 6 && SECRET_NAME.test(name)) out = out.split(value).join('[redacted]');
  }
  return out;
}

const cell = (text: string): string => text.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

const FALLBACKS: Record<string, string> = {
  A: 'M keeps one cart. U creates the session for that cart; after order creation U calls `ensureRecurringPaymentStrategy(order.id)` (a no-op under A) and `stampOrderCustomFields`.',
  'A-prime':
    'M keeps one cart. U creates the session for that cart; right after order creation U calls `ensureRecurringPaymentStrategy(order.id)` to set the strategy on each recurring cart, then `stampOrderCustomFields`.',
  F1: 'Custom Line Items for one-time charges: M `addOfferLine` creates equipment purchases and device outright lines as Custom Line Items (`name`, `slug: <sku>`, `money` from the variant one-time price) instead of Line Items; the activation fee already is one. `lib/ct/availability.ts` still blocks the add before it is created. Cost: no product link on the order line.',
  F2: 'Two carts: at "Pay" U splits the bundle cart into R (all recurring lines) and O (one-time lines). R goes to the hosted Checkout (Order, Recurring Order, first month); O is paid with a second session ("Pay one-time fees"). If O fails, R stays ordered and O is shown as unpaid on the confirmation page. M keeps one cart; only U changes.',
  F3: 'Checkout in Payment Only mode: switch the Checkout Application to Payment Only if Complete mode refuses the mixed cart; U renders its own steps around the payment and needs address and shipping on the cart before the session.',
};

const OTHERS = 'A / A-prime: one mixed cart; F1: Custom Line Items for one-time charges; F2: two carts; F3: Payment Only mode.';

export function fallbackParagraph(architecture: string): string {
  const key = architecture === 'PENDING (OA-05)' ? 'A' : architecture;
  const text = FALLBACKS[key];
  return text ? `${text} Other options: ${OTHERS}` : `No fallback applies to ${architecture}: owner decision needed. ${OTHERS}`;
}

/** The block body without the markers. */
export function renderFindings(results: ProbeResult[], decision: Decision, nowIso: string, extras: FindingsExtras = { mixAccepted: 'unknown', openItems: [] }): string {
  const rows = results.map((r) => `| ${r.id} | ${cell(r.title)} | ${r.status} | ${cell(r.evidence)} |`);
  const mix = extras.mixAccepted === 'yes' ? 'yes (P1/P6)' : extras.mixAccepted === 'no' ? 'no' : 'unknown';
  const blockedItems = results.filter((r) => r.status === 'BLOCKED').map((r) => `${r.id} (${r.evidence})`);
  const open = [...extras.openItems, ...blockedItems];
  const body = [
    `## L - Checkout spike (recurring + one-time) - run ${nowIso}`,
    `Result: ${decision.architecture}  |  Gate 2: owner review required`,
    '',
    `Why: ${cell(decision.rationale)}`,
    '',
    '| Probe | Title | Status | Evidence |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `Accepted action field names: ${extras.acceptedAction ?? 'none accepted'}`,
    `Initial cart may mix recurring and one-time lines: ${mix}   (documented for Orders API Method A; Checkout behaviour per P4)`,
    `Recurring grouping: ${extras.grouping ?? 'unknown'}`,
    `Fallback plan: ${fallbackParagraph(decision.architecture)}`,
    `Open items: ${open.length > 0 ? open.join('; ') : 'none'}`,
  ].join('\n');
  return redact(body);
}

/** Replaces the text between the markers, or appends the marked block at the end of the file when the markers are absent. */
export function writeBetweenMarkers(filePath: string, begin: string, end: string, text: string): void {
  const block = `${begin}\n${text}\n${end}`;
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const from = current.indexOf(begin);
  const to = current.indexOf(end);
  let next: string;
  if (from >= 0 && to > from) next = current.slice(0, from) + block + current.slice(to + end.length);
  else next = `${current}${current === '' || current.endsWith('\n') ? '' : '\n'}\n${block}\n`;
  writeFileSync(filePath, next);
}
