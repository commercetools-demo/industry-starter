'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { PageHead } from '@/components/ui/PageHead';
import { useToast } from '@/components/ui/Toast';
import { useAddRxLines, type AddRxLines } from '@/hooks/use-cart';
import { useListActions } from '@/hooks/use-lists';
import { API_PRESCRIPTIONS_LOOKUP } from '@/lib/api-paths';
import { echoable } from '@/lib/dispense/rx-number';
import type { RxQuickPick, RxView } from '@/lib/types';
import { RxLookupForm } from './RxLookupForm';
import { RxResultCard } from './RxResultCard';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; view: RxView }
  | { status: 'not-found'; input: string }
  | { status: 'limited' }
  | { status: 'error' };

export interface RxLookupProps {
  quickPicks: RxQuickPick[];
  /** Test seam: replaces the cart hook's function. */
  addRxLines?: AddRxLines;
}

/**
 * The prescriptions page body: head with the lookup form, then the muted empty card, the not-found message
 * (identical for unknown and someone else's number), the rate-limit message or the result card.
 * Nothing about the lookup is written to the URL, to storage or to the console.
 */
export function RxLookup({ quickPicks, addRxLines }: RxLookupProps) {
  const t = useTranslations('rx');
  const toast = useToast();
  const cartAdd = useAddRxLines();
  const add = addRxLines ?? cartAdd;
  const { saveRx } = useListActions();
  const [state, setState] = useState<State>({ status: 'idle' });

  async function search(input: string) {
    setState({ status: 'loading' });
    try {
      const response = await fetch(API_PRESCRIPTIONS_LOOKUP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rx: input }) });
      if (response.ok) return setState({ status: 'found', view: (await response.json()) as RxView });
      if (response.status === 404) return setState({ status: 'not-found', input: echoable(input) });
      if (response.status === 429) return setState({ status: 'limited' });
      setState({ status: 'error' });
    } catch {
      setState({ status: 'error' });
    }
  }

  return (
    <>
      <PageHead title={t('title')} sub={t('sub')}>
        <RxLookupForm busy={state.status === 'loading'} quickPicks={quickPicks} onSearch={search} />
      </PageHead>
      <div className="mx-auto mt-8 grid max-w-215 gap-4 px-5 pb-12 nav:px-8" aria-live="polite">
        {state.status === 'not-found' ? (
          <Card className="font-medium text-danger-700" role="alert" data-rx-message="not-found">
            {t('notFound', { input: state.input })}
          </Card>
        ) : null}
        {state.status === 'limited' ? (
          <Card className="font-medium text-danger-700" role="alert" data-rx-message="rate-limited">
            {t('rateLimited')}
          </Card>
        ) : null}
        {state.status === 'error' ? (
          <Card className="font-medium text-danger-700" role="alert" data-rx-message="error">
            {t('error')}
          </Card>
        ) : null}
        {state.status === 'idle' ? <Card className="text-neutral-600">{t('empty')}</Card> : null}
        {state.status === 'found' ? (
          <RxResultCard
            key={state.view.number}
            view={state.view}
            onAdd={add}
            onSave={saveRx}
            onAdded={() => toast.show({ message: t('added'), action: { label: t('viewCart'), href: '/cart' } })}
          />
        ) : null}
      </div>
    </>
  );
}
