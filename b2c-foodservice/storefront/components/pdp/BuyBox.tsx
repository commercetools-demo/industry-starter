'use client';

import { useTranslations } from 'next-intl';
import AddToBag from '@/components/pdp/AddToBag';
import BuyBoxHeader from '@/components/pdp/BuyBoxHeader';
import CollectBlock from '@/components/pdp/CollectBlock';
import DetailAccordions from '@/components/pdp/DetailAccordions';
import FactsRow from '@/components/pdp/FactsRow';
import FulfilmentCards from '@/components/pdp/FulfilmentCards';
import OptionGroup from '@/components/pdp/OptionGroup';
import ShipBlock from '@/components/pdp/ShipBlock';
import SubscribeBlock from '@/components/pdp/SubscribeBlock';
import TrustRow from '@/components/pdp/TrustRow';
import { usePdp } from '@/components/pdp/pdp-state';

/**
 * The right column (workstream H, 3.5 and 3.8): header, facts, one selector per product choice, the fulfilment cards and
 * the block of the chosen fulfilment, the add button, the trust row and the details accordions. The accordions come after
 * the add button so the button stays within two screens on a phone. State lives in `PdpProvider`.
 */
export default function BuyBox() {
  const t = useTranslations('pdp');
  const { data, fulfilment, collectionEnabled } = usePdp();
  const { product } = data;
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="buy-box">
      <BuyBoxHeader />
      <FactsRow />
      {product.selectors.map((s) => (
        <OptionGroup key={s.attr} selector={s} />
      ))}
      <FulfilmentCards />
      {fulfilment === 'collect' && collectionEnabled ? <CollectBlock /> : fulfilment === 'subscribe' ? <SubscribeBlock /> : <ShipBlock />}
      {data.inventoryFailed && fulfilment === 'subscribe' ? (
        <p role="status" className="m-0 text-[12.5px] text-ink-3">{t('error.stockUnknown')}</p>
      ) : null}
      <AddToBag />
      <TrustRow returnDays={data.returnDays} />
      <DetailAccordions />
    </div>
  );
}
