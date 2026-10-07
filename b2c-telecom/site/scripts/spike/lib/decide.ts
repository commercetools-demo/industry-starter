// The decision table of the checkout spike (Gate 2). Pure.
import type { ProbeResult, ProbeStatus } from './probe';

export type Architecture = 'A' | 'A-prime' | 'F1' | 'F2' | 'F3' | 'BLOCKED-DATA' | 'BLOCKED-CHECKOUT' | 'BLOCKED-RECURRING-PAYMENT' | 'PENDING (OA-05)' | 'INCONCLUSIVE';

export interface Decision {
  architecture: Architecture;
  rationale: string;
}

const MIXED_HINT = /recurr|mixed|payment\s*strategy/i;

export function decide(results: ProbeResult[]): Decision {
  const find = (id: string): ProbeResult | undefined => results.find((r) => r.id === id);
  const is = (id: string, status: ProbeStatus): boolean => find(id)?.status === status;
  const done = (architecture: Architecture, rationale: string): Decision => ({ architecture, rationale });

  if (is('P2', 'FAIL')) return done('BLOCKED-DATA', 'A recurring variant has no price tied to malva-monthly: fix the G seed and re-run.');

  if (is('P6', 'FAIL') || is('P1', 'FAIL')) {
    if (is('P1b', 'PASS') && is('P1c', 'FAIL')) return done('F1', 'Recurring plus a Custom Line Item works, recurring plus a one-time Line Item does not: every one-time charge becomes a Custom Line Item.');
    return done('F2', 'A cart mixing recurring and one-time lines cannot be ordered: split into a recurring cart and a one-time cart.');
  }

  if (is('P4', 'FAIL')) {
    const text = find('P4')?.evidence ?? '';
    return MIXED_HINT.test(text)
      ? done('F3', 'Session creation refuses the mixed cart and the error names recurring, mixed or payment strategy: use Checkout in Payment Only mode.')
      : done('BLOCKED-CHECKOUT', 'Session creation failed for a reason unrelated to recurring lines: configuration problem for the owner.');
  }

  if (is('P8', 'FAIL') && is('P9', 'FAIL')) {
    return done('BLOCKED-RECURRING-PAYMENT', 'The payment strategy is neither inherited by the recurring cart nor settable on it: owner escalation (D-041).');
  }

  const guess: Architecture = is('P3', 'PASS') && is('P8', 'PASS') ? 'A' : is('P9', 'PASS') ? 'A-prime' : 'INCONCLUSIVE';

  if (is('P3', 'BLOCKED') || is('P4', 'BLOCKED')) {
    return done('PENDING (OA-05)', `Checkout probes are blocked until OA-05 is done. Best guess from the other probes: ${guess}.`);
  }
  if (guess === 'A') return done('A', 'One mixed cart; the strategy is set on the initial cart and inherited by the recurring cart.');
  if (guess === 'A-prime') return done('A-prime', 'One mixed cart; the strategy is not inherited, so U calls ensureRecurringPaymentStrategy right after the order is created.');
  return done('INCONCLUSIVE', 'The probes P3, P8 and P9 did not produce a usable combination: read the evidence and re-run.');
}
