import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardBody } from '@/components/ui/Card';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { offerAnchorId } from '@/lib/listing/links';
import type { Locale, Offer } from '@/lib/types';

function DeviceCard({ offer, highlighted }: { offer: Offer; highlighted: boolean }): ReactElement {
  const t = useTranslations('plp.device');
  const locale = useLocale() as Locale;
  const master = offer.variants.find((variant) => variant.isMaster) ?? offer.variants[0];
  const outright = master?.oneTimePrice;
  const monthly = master?.financedPrices?.[0];
  return (
    <div
      id={offerAnchorId(offer.key)}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('scroll-mt-28 rounded-xl', highlighted && 'outline-4 outline-offset-4 outline-action')}
    >
      <Card as="article" className="h-full">
        <CardBody>
          <h2 className="m-0 font-display text-3xl font-bold">{offer.name}</h2>
          {outright ? <p className="m-0 font-display text-2xl font-bold">{t('from', { price: formatMoney(outright, locale) })}</p> : null}
          {monthly ? <p className="m-0 text-md text-text-muted">{t('fromMonthly', { price: formatMoney(monthly, locale) })}</p> : null}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * The devices category until workstream Q builds its cards (acquisition mode, memory, colour): name and the lowest outright and monthly
 * prices, no cart actions. Q replaces this component in `app/[locale]/shop/[slug]/page.tsx` (append-only change by Q).
 */
export function DeviceListingSlot({ offers, highlightKey }: { offers: Offer[]; highlightKey: string | null }): ReactElement {
  return (
    <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]">
      {offers.map((offer) => (
        <li key={offer.key}>
          <DeviceCard offer={offer} highlighted={offer.key === highlightKey} />
        </li>
      ))}
    </ul>
  );
}
