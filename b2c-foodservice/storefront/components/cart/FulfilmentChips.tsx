'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import type { CartLine } from '@/lib/types';
import { useCollectionOffered } from './use-cart-ui';

const CHIP =
  'transition-state inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-[12px] font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

/**
 * The Collect / Ship chip pair of a line (a `radiogroup`, active chip filled with ink). Not rendered for subscription lines
 * (their schedule is changed on the product page) and not in a market without collection (Canada has no Collect chip).
 * The inactive chip switches the line; the server decides about a merge and the response moves the line. The Collect chip is
 * `aria-disabled` with a title when the shopper's chosen store has none in stock.
 */
export default function FulfilmentChips({
  line, pending, onCollect, onShip,
}: {
  line: CartLine;
  pending: boolean;
  onCollect: () => void;
  onShip: () => void;
}) {
  const t = useTranslations('cart.line.chip');
  const offered = useCollectionOffered();
  if (line.fulfilment === 'subscribe' || !offered) return null;

  const collectActive = line.fulfilment === 'collect';
  const out = line.collectAtSessionStore?.state === 'out';
  const collectDisabled = !collectActive && out;
  const collectTitle = collectDisabled ? t('collectDisabled', { store: line.collectAtSessionStore?.storeName ?? '' }) : undefined;
  const state = (active: boolean) => (active ? 'border-ink bg-ink text-surface' : 'border-line-2 bg-surface text-ink hover:border-ink');

  return (
    <div role="radiogroup" aria-label={t('label')} className="flex flex-wrap gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={collectActive}
        aria-disabled={collectDisabled || pending || undefined}
        title={collectTitle}
        className={`${CHIP} ${state(collectActive)}`}
        onClick={() => {
          if (!collectActive && !collectDisabled && !pending) onCollect();
        }}
      >
        <Icon name="store" size={14} />
        {t('collect')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!collectActive}
        aria-disabled={pending || undefined}
        className={`${CHIP} ${state(!collectActive)}`}
        onClick={() => {
          if (collectActive && !pending) onShip();
        }}
      >
        <Icon name="truck" size={14} />
        {t('delivery')}
      </button>
    </div>
  );
}
