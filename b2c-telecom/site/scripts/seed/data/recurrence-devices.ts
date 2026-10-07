// Device-financing recurrence policies (D-060): a price is tied to one policy, so each mode and term has its own.
// All are monthly. `malva-monthly` (F) stays the policy of every service line, add-on and equipment rental.
import type { RecurrencePolicyDraft } from '../types';
import { ls } from './catalog-types';
import { INSTALLMENT_TERMS, LEASE_POLICY, LEASE_TERM, installmentPolicy } from './prices';

const monthly = { type: 'standard', value: 1, intervalUnit: 'Months' } as const;

export const deviceRecurrencePolicies: RecurrencePolicyDraft[] = [
  ...INSTALLMENT_TERMS.map(
    (term): RecurrencePolicyDraft => ({
      key: installmentPolicy(term),
      name: ls(`Installment, ${term} months`, `Raten, ${term} Monate`),
      description: ls(`Handset paid in ${term} monthly installments.`, `Handy in ${term} monatlichen Raten bezahlt.`),
      schedule: monthly,
    }),
  ),
  {
    key: LEASE_POLICY,
    name: ls(`Lease, ${LEASE_TERM} months`, `Miete, ${LEASE_TERM} Monate`),
    description: ls(`Handset leased for ${LEASE_TERM} months.`, `Handy für ${LEASE_TERM} Monate gemietet.`),
    schedule: monthly,
  },
];
