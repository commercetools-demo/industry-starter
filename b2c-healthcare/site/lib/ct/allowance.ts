import 'server-only';
import { createOnly, getObject, putObject, queryObjects } from '@/lib/ct/custom-objects';
import { loadFundingFixtures } from '@/lib/ct/fixtures';
import * as core from '@/lib/funding/allowance-core';
import type { AllowanceView } from '@/lib/funding/allowance-types';
import { log } from '@/lib/log';

/**
 * Benefit allowance for the storefront: the logic is `lib/funding/allowance-core.ts`; this module gives
 * it the BFF's Custom Object store (or the in-memory one under `MALVA_FIXTURES=1`, development only). See the core
 * module for the rules: versioned writes, idempotency on the order id, restore to the open cycle only, forfeiture.
 */

export type { AllowanceStore, DrawdownResult, ReloadResult, RestoreAllowanceResult } from '@/lib/funding/allowance-core';
export { AllowanceContendedError } from '@/lib/funding/allowance-core';

const customObjectStore: core.AllowanceStore = { get: getObject, put: putObject, createOnly, query: queryObjects };

async function store(): Promise<core.AllowanceStore> {
  const fixtures = await loadFundingFixtures();
  return fixtures ? fixtures.fixtureStore : customObjectStore;
}

/** The member's allowance for the cycle `now` falls in, or null when none exists (the member has no allowance). */
export async function getAllowanceView(patientRef: string, now: Date = new Date()): Promise<AllowanceView | null> {
  return core.getAllowanceView(await store(), patientRef, now);
}

/** What the member can draw now, in cents (0 without an allowance). */
export async function getBalance(patientRef: string, now: Date = new Date()): Promise<number> {
  return (await getAllowanceView(patientRef, now))?.balance ?? 0;
}

/** Draws `min(amount, balance)` for the order from the current cycle; idempotent on `orderId`. */
export async function drawdown(patientRef: string, orderId: string, amount: number, now: Date = new Date()): Promise<core.DrawdownResult> {
  return core.drawdown(await store(), patientRef, orderId, amount, now);
}

/** Gives the order's draw back (cancel or return): to the open cycle, or reported `unrecoverable`. Idempotent. */
export async function restoreAllowance(orderId: string, now: Date = new Date()): Promise<core.RestoreAllowanceResult> {
  const result = await core.restoreAllowance(await store(), orderId, now);
  if (result.outcome === 'unrecoverable') log.error('allowance', 'could not restore: the cycle has closed', { name: 'unrecoverable' });
  return result;
}

/** Grants a cycle: create-only, so the same member and cycle twice is the same result. */
export async function grantCycle(patientRef: string, cycle: string, monthly: number, currency = 'USD'): Promise<{ created: boolean }> {
  return core.grantCycle(await store(), patientRef, cycle, monthly, currency);
}

/** The monthly reload: grant the current cycle once, forfeit what is left of earlier cycles once. */
export async function reloadAllowances(now: Date = new Date()): Promise<core.ReloadResult> {
  return core.reloadAllowances(await store(), now);
}
