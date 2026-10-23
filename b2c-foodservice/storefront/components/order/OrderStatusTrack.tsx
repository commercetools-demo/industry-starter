'use client';

import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { OrderState } from '@/lib/types';

export const TRACK_STATES: readonly OrderState[] = ['ordered', 'preparing', 'ready-for-collection', 'collected'];
type NodeState = 'done' | 'current' | 'upcoming';

/**
 * State of each of the four nodes for an order state. With `i` the index of the current state: nodes before `i` are done, node `i`
 * is current, the rest upcoming; at the last state (`collected`) all four are done. Pure, so L (the account) can reuse the rule.
 */
export function nodeStates(state: OrderState): NodeState[] {
  const i = TRACK_STATES.indexOf(state);
  return TRACK_STATES.map((_, n): NodeState => (i === TRACK_STATES.length - 1 || n < i ? 'done' : n === i ? 'current' : 'upcoming'));
}

const LABEL_KEY = { ordered: 'ordered', preparing: 'preparing', 'ready-for-collection': 'ready', collected: 'collected' } as const;

/**
 * The collection tracker: four nodes (Ordered, Preparing, Ready, Collected). `ordered` is Ordered ACTIVE (not done: the prototype
 * showed Ordered done and Preparing active the moment an order was placed, which is not what the order says, Q-K-12). The state is
 * words as well as colour. `null` (no tracker for this order) renders nothing. Reused by the account order list (workstream L).
 */
export default function OrderStatusTrack({ state }: { state: OrderState | null }) {
  const t = useTranslations('order.track');
  if (!state) return null;
  const states = nodeStates(state);
  return (
    <ol aria-label={t('label')} className="m-0 flex list-none p-0" data-testid="order-track" data-state={state}>
      {TRACK_STATES.map((s, n) => {
        const node = states[n] as NodeState;
        const label = t(LABEL_KEY[s]);
        return (
          <Fragment key={s}>
            <li
              data-node={s}
              data-status={node}
              aria-label={`${label}: ${t(node === 'done' ? 'done' : node === 'current' ? 'current' : 'upcoming')}`}
              className="relative flex flex-1 flex-col items-center gap-2 text-center"
            >
              {n > 0 ? (
                <span aria-hidden="true" className={cn('absolute right-1/2 top-[14px] h-0.5 w-full', node === 'done' ? 'bg-teal-strong' : 'bg-line-2')} />
              ) : null}
              <span
                className={cn(
                  'relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-pill border-2',
                  node === 'done' && 'border-teal-strong bg-teal-strong text-surface',
                  node === 'current' && 'border-accent bg-surface',
                  node === 'upcoming' && 'border-line-2 bg-surface',
                )}
              >
                {node === 'done' ? <Icon name="check" size={16} /> : null}
                {node === 'current' ? <span className="h-3 w-3 rounded-pill bg-accent" /> : null}
              </span>
              <span className={cn('text-[11.5px] font-semibold', node === 'upcoming' ? 'text-ink-3' : 'text-ink')}>{label}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
