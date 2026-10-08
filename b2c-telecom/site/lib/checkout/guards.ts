import { isPhysicalLine } from './physical';
import { isValidEmail } from './steps';
import type { BundleIssue, Cart, CheckoutState, Money } from '@/lib/types';

export type ReadinessCode = 'NO_CONTACT' | 'NO_ADDRESS' | 'NO_DELIVERY';

/** The cart has what an order needs, checked in the order of the session route: contact, address, delivery (physical lines only). */
export function checkReadiness(state: Pick<CheckoutState, 'email' | 'serviceAddress' | 'delivery' | 'cart'>): ReadinessCode | null {
  if (state.email === null || !isValidEmail(state.email)) return 'NO_CONTACT';
  if (state.serviceAddress === null) return 'NO_ADDRESS';
  if (state.cart.lines.some(isPhysicalLine) && state.delivery === null) return 'NO_DELIVERY';
  return null;
}

export interface IssueSplit {
  /** Lines the service address cannot be served for (K serviceability). */
  notServiceable: BundleIssue[];
  /** Every other blocking rule (compatibility, exclusivity, eligibility). */
  eligibility: BundleIssue[];
}

/** Splits the cart's blocking issues into "not serviceable at this address" and everything else. */
export function splitIssues(issues: BundleIssue[]): IssueSplit {
  const isLocation = (issue: BundleIssue): boolean => issue.reasons.length > 0 && issue.reasons.every((reason) => reason.code === 'NOT_SERVICEABLE');
  return { notServiceable: issues.filter(isLocation), eligibility: issues.filter((issue) => !isLocation(issue)) };
}

/** The total the buyer saw against the cart's total now (spec checkout "Totals moved after authorization"). */
export function compareTotal(cart: Pick<Cart, 'summary'>, expectedCents: number): { ok: true } | { ok: false; total: Money } {
  const total = cart.summary.total;
  return total.centAmount === expectedCents ? { ok: true } : { ok: false, total };
}
