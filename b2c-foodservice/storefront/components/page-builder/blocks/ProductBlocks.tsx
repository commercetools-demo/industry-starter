'use client';

import { useTranslations } from 'next-intl';
import CollectBlock from '@/components/pdp/CollectBlock';
import FulfilmentCards from '@/components/pdp/FulfilmentCards';
import OptionGroup from '@/components/pdp/OptionGroup';
import ShipBlock from '@/components/pdp/ShipBlock';
import SubscribeBlock from '@/components/pdp/SubscribeBlock';
import TrustRow from '@/components/pdp/TrustRow';
import { usePdp } from '@/components/pdp/pdp-state';

/**
 * Product page parts that the native `BuyBox` composes from several pieces. They are client components because they read the
 * shared `PdpProvider` state (selection, fulfilment, quantity, store), which the product route puts around the whole authored
 * page. The parts that read it directly (gallery, header, facts, add to bag, details) are mapped without a wrapper.
 */

/** One selector per product choice (pack size, grind, colour ...). */
export function OptionsBlock() {
  const { data } = usePdp();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {data.product.selectors.map((s) => (
        <OptionGroup key={s.attr} selector={s} />
      ))}
    </div>
  );
}

/** The fulfilment choice (deliver, collect, subscribe) and the block of the chosen one. */
export function FulfilmentBlock() {
  const t = useTranslations('pdp');
  const { data, fulfilment, collectionEnabled } = usePdp();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FulfilmentCards />
      {fulfilment === 'collect' && collectionEnabled ? <CollectBlock /> : fulfilment === 'subscribe' ? <SubscribeBlock /> : <ShipBlock />}
      {data.inventoryFailed && fulfilment === 'subscribe' ? (
        <p role="status" className="m-0 text-[12.5px] text-ink-3">{t('error.stockUnknown')}</p>
      ) : null}
    </div>
  );
}

export function TrustBlock() {
  const { data } = usePdp();
  return <TrustRow returnDays={data.returnDays} />;
}
