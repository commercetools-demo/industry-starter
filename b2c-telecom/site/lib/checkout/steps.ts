import { EMAIL_MAX, EMAIL_PATTERN } from '@/lib/config/checkout';
import type { CheckoutState, CheckoutStep } from '@/lib/types';

export const ALL_STEPS: readonly CheckoutStep[] = ['contact', 'address', 'delivery', 'review', 'payment'];

export const isCheckoutStep = (value: unknown): value is CheckoutStep => typeof value === 'string' && (ALL_STEPS as readonly string[]).includes(value);

export const isValidEmail = (value: string): boolean => value.length <= EMAIL_MAX && EMAIL_PATTERN.test(value);

/** The steps this bundle goes through: a digital-only bundle skips delivery (D-043). */
export function stepsFor(state: Pick<CheckoutState, 'needsDelivery'>): CheckoutStep[] {
  return ALL_STEPS.filter((step) => step !== 'delivery' || state.needsDelivery);
}

/** Whether the data of a step is on the cart. `review` and `payment` have no data of their own. */
export function isStepComplete(step: CheckoutStep, state: CheckoutState): boolean {
  switch (step) {
    case 'contact':
      return state.email !== null && isValidEmail(state.email);
    case 'address':
      return state.serviceAddress !== null;
    case 'delivery':
      return !state.needsDelivery || state.delivery !== null;
    default:
      return false;
  }
}

/** The first step whose predecessors are all complete but which is not itself complete (review when everything is). */
export function firstIncompleteStep(state: CheckoutState): CheckoutStep {
  for (const step of stepsFor(state)) {
    if (step === 'review') return 'review';
    if (!isStepComplete(step, state)) return step;
  }
  return 'review';
}

/**
 * The step to show for a requested step: an unknown value is `contact`; `payment` is never a landing step (a session is created only by
 * "Continue to payment", so a reload goes back to review); a step beyond the first incomplete one redirects to it.
 */
export function resolveStep(requested: string | undefined, state: CheckoutState): CheckoutStep {
  const steps = stepsFor(state);
  const first = firstIncompleteStep(state);
  const wanted: CheckoutStep = isCheckoutStep(requested) ? (requested === 'payment' ? 'review' : requested) : 'contact';
  if (!steps.includes(wanted)) return first;
  return steps.indexOf(wanted) > steps.indexOf(first) ? first : wanted;
}
