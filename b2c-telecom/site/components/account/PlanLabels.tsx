import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { AccountPlanLabels } from '@/components/label/AccountPlanLabels';
import type { ActivePlan, BroadbandLabelData } from '@/lib/types';

/**
 * "Your plans": the Broadband Facts label of each active plan, exactly as stored on its order (the snapshot rule: nothing is rebuilt
 * from the live catalog, so a later price change cannot alter the disclosure the customer signed). Add-ons have no label and never
 * arrive here. A plan whose order has no snapshot gets a note instead. Two orders of the same plan show its label once.
 */
export function PlanLabels({ plans }: { plans: ActivePlan[] }): ReactElement {
  const t = useTranslations('account');
  const seen = new Set<string>();
  const labels: BroadbandLabelData[] = [];
  for (const plan of plans) {
    if (plan.label && !seen.has(plan.label.id)) {
      seen.add(plan.label.id);
      labels.push(plan.label);
    }
  }
  const missing = plans.filter((plan) => plan.label === null);
  return (
    <div className="flex flex-col gap-7">
      <AccountPlanLabels labels={labels} />
      {missing.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {missing.map((plan) => (
            <li key={plan.key} className="rounded-xl border border-border p-5 text-md">
              <span className="font-display font-semibold">{plan.name}</span>
              {' · '}
              {t('order.noLabel')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
