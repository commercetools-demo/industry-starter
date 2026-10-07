// Cart update actions of a device line and the guard against the price fallback. Pure: no I/O and no SDK import (the action shapes
// below are structurally the SDK's `CartUpdateAction`, so lib/ct passes them to the API as they are).
import { policyKeyFor, readAcquisition, endOfTermFor } from '@/lib/devices/acquisition';
import { LINE_ITEM_TYPE_KEY } from '@/lib/config/devices';
import type { AcquisitionMode } from '@/lib/types';

export interface AddDeviceLineAction {
  action: 'addLineItem';
  sku: string;
  quantity: number;
  addedAt?: string;
  recurrenceInfo?: { recurrencePolicy: { typeId: 'recurrence-policy'; key: string }; priceSelectionMode: 'Fixed' };
  custom: { type: { typeId: 'type'; key: string }; fields: Record<string, string | number> };
}
export interface RemoveLineAction {
  action: 'removeLineItem';
  lineItemId: string;
}

export interface AddDeviceInput {
  sku: string;
  offerKey: string;
  quantity: number;
  mode: AcquisitionMode;
  termMonths: number;
  /** ISO time: keeps a re-added line where it was in the bundle (M orders lines by `addedAt`). */
  addedAt?: string;
}

/**
 * `addLineItem` of one device line. A financed line carries the policy of its mode and term with price selection `Fixed` (a committed
 * term, L); an outright line carries no `recurrenceInfo` at all, so it gets the one-time price. The mode, term and what happens at the
 * end of the term are written as line custom fields (not inferred from the price later).
 */
export function buildAddDeviceActions(input: AddDeviceInput): [AddDeviceLineAction] {
  const policyKey = policyKeyFor(input.mode, input.termMonths);
  const term = input.mode === 'outright' ? 0 : input.termMonths;
  return [
    {
      action: 'addLineItem',
      sku: input.sku,
      quantity: input.quantity,
      ...(input.addedAt ? { addedAt: input.addedAt } : {}),
      ...(policyKey ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy' as const, key: policyKey }, priceSelectionMode: 'Fixed' as const } } : {}),
      custom: {
        type: { typeId: 'type', key: LINE_ITEM_TYPE_KEY },
        fields: { offerKey: input.offerKey, acquisitionMode: input.mode, acquisitionTermMonths: term, acquisitionEndOfTerm: endOfTermFor(input.mode) },
      },
    },
  ];
}

export interface ExistingDeviceLine {
  lineItemId: string;
  sku: string;
  offerKey: string;
  quantity: number;
  addedAt?: string;
}

/**
 * Changing the mode is ONE update with two actions: remove the old line, add the same sku and quantity in the new mode. The price is
 * resolved from scratch and the resolution guard runs again; recurrence is never patched on an existing line. The line id changes.
 */
export function buildChangeModeActions(existing: ExistingDeviceLine, next: { mode: AcquisitionMode; termMonths: number }): [RemoveLineAction, AddDeviceLineAction] {
  const [add] = buildAddDeviceActions({ sku: existing.sku, offerKey: existing.offerKey, quantity: existing.quantity, mode: next.mode, termMonths: next.termMonths, ...(existing.addedAt ? { addedAt: existing.addedAt } : {}) });
  return [{ action: 'removeLineItem', lineItemId: existing.lineItemId }, add];
}

/** What the price of a line resolved to: the one-time price (no policy) or a recurring price of one policy. */
export interface ResolvedLine {
  id?: string;
  price?: { recurrencePolicy?: { id: string } | undefined } | undefined;
  recurrenceInfo?: { recurrencePolicy: { id: string } } | undefined;
}

export type PriceCheck = 'ok' | 'price-has-no-policy' | 'price-of-another-policy' | 'line-has-no-recurrence' | 'line-of-another-policy' | 'outright-has-recurrence' | 'policy-unknown';

/**
 * Did the price come from the policy of the line? `expectedPolicyId` is the id of the policy of the mode and term, `null` for outright.
 * Never compares amounts: a financed line that fell back to the outright price has no policy on its price, whatever its amount.
 */
export function checkPriceFromPolicy(line: ResolvedLine, expectedPolicyId: string | null): PriceCheck {
  const priced = line.price?.recurrencePolicy?.id;
  if (expectedPolicyId === null) return priced === undefined && line.recurrenceInfo === undefined ? 'ok' : 'outright-has-recurrence';
  if (priced === undefined) return 'price-has-no-policy';
  if (priced !== expectedPolicyId) return 'price-of-another-policy';
  if (!line.recurrenceInfo) return 'line-has-no-recurrence';
  return line.recurrenceInfo.recurrencePolicy.id === expectedPolicyId ? 'ok' : 'line-of-another-policy';
}

export class PriceNotForTermError extends Error {
  readonly code = 'PRICE_NOT_FOR_TERM';
  constructor(
    readonly check: Exclude<PriceCheck, 'ok'>,
    readonly lineItemId?: string,
  ) {
    super(`The price of the line does not come from its recurrence policy (${check}).`);
    this.name = 'PriceNotForTermError';
  }
}

/** Throws `PriceNotForTermError` (the route answers 422 PRICE_NOT_FOR_TERM and removes the line) unless the price came from the policy. */
export function assertPriceFromPolicy(line: ResolvedLine, expectedPolicyId: string | null): void {
  const result = checkPriceFromPolicy(line, expectedPolicyId);
  if (result !== 'ok') throw new PriceNotForTermError(result, line.id);
}

export interface DeviceCartLine extends ResolvedLine {
  id: string;
  custom?: { fields?: Record<string, unknown> | undefined } | undefined;
}

/**
 * Every device line of the cart must still price from the policy of its recorded mode and term. U calls this before it creates a checkout
 * session. Returns the offending line ids with the check that failed; `assertDeviceCartIntegrity` throws for the first one.
 */
export function deviceCartViolations(lines: readonly DeviceCartLine[], policyIdByKey: Readonly<Record<string, string>>): { lineItemId: string; check: Exclude<PriceCheck, 'ok'> }[] {
  return lines.flatMap((line) => {
    const acquisition = readAcquisition(line.custom?.fields);
    if (!acquisition) return [];
    const key = policyKeyFor(acquisition.mode, acquisition.termMonths);
    const expected = key === null ? null : policyIdByKey[key];
    if (expected === undefined) return [{ lineItemId: line.id, check: 'policy-unknown' as const }];
    const check = checkPriceFromPolicy(line, expected);
    return check === 'ok' ? [] : [{ lineItemId: line.id, check }];
  });
}

export function assertDeviceCartIntegrity(lines: readonly DeviceCartLine[], policyIdByKey: Readonly<Record<string, string>>): void {
  const [first] = deviceCartViolations(lines, policyIdByKey);
  if (first) throw new PriceNotForTermError(first.check, first.lineItemId);
}
