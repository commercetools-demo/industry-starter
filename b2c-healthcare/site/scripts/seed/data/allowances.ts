import type { AllowanceCycle } from '../../../lib/funding/allowance-types';
import { SAM } from './patients';

/**
 * Benefit allowance seed (demo): Sam's sponsor grants $50.00 each month. The seed creates the cycle
 * the seed run falls in (create-only, so a re-seed never resets a balance that has been drawn); the scheduled
 * `reload-allowances` creates the following ones. Cycle objects are Custom Objects in `malva-allowance`.
 */
export const ALLOWANCE_MONTHLY_CENTS = 5000;

export const ALLOWANCE_MEMBERS: { patientRef: string; monthly: number }[] = [{ patientRef: SAM.patientRef, monthly: ALLOWANCE_MONTHLY_CENTS }];

export const cycleFor = (at: Date): string => `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

export const allowanceObjectKey = (patientRef: string, cycle: string): string => `${patientRef}_${cycle}`;

export const allowanceCycle = (patientRef: string, monthly: number, cycle: string): AllowanceCycle => ({
  patientRef, cycle, currency: 'USD', granted: monthly, consumed: 0, lapsed: 0, monthly, drawdowns: {}, restored: [],
});
