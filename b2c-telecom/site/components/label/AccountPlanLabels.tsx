import type { ReactElement } from 'react';
import type { BroadbandLabelData } from '@/lib/types';
import { BroadbandLabel } from './BroadbandLabel';

/**
 * One label per active plan (the account page, workstream S passes the labels of the order's stored snapshot, never today's catalog).
 * Add-ons, equipment and devices have no label and are never in the list. An empty list renders nothing.
 */
export function AccountPlanLabels({ labels }: { labels: BroadbandLabelData[] }): ReactElement | null {
  if (labels.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
      {labels.map((label) => (
        <BroadbandLabel key={label.id} label={label} />
      ))}
    </div>
  );
}
