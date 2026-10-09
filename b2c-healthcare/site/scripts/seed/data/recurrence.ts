import { PREFIX } from '../lib';
import { L } from './types';

/**
 * Auto-refill. Two Recurrence Policies, StandardSchedule: every month and every three months.
 * Price selection (`Dynamic`) is set on the recurring line item at creation, not on the policy: a refill is priced at
 * the catalog price on the day it is generated and the buyer is told so.
 */
export const POLICY_MONTHLY = `${PREFIX}monthly`;
export const POLICY_QUARTERLY = `${PREFIX}quarterly`;

export const RECURRENCE_POLICIES = [
  { key: POLICY_MONTHLY, name: L('Every month'), schedule: { type: 'standard', intervalUnit: 'Months', value: 1 } },
  { key: POLICY_QUARTERLY, name: L('Every 3 months'), schedule: { type: 'standard', intervalUnit: 'Months', value: 3 } },
];

/** Custom type of a saved-list line (`mlv-list-line`): the prescription reference and the price when it was saved. */
export const LIST_LINE_TYPE = {
  key: `${PREFIX}list-line`,
  name: L('Saved list line'),
  resourceTypeIds: ['line-item'],
  fieldDefinitions: [
    { name: 'rxNumber', label: L('Prescription number'), required: false, type: { name: 'String' } },
    { name: 'rxLineRef', label: L('Prescription line reference'), required: false, type: { name: 'String' } },
    { name: 'savedUnitPrice', label: L('Unit price when saved'), required: false, type: { name: 'Money' } },
  ],
};
