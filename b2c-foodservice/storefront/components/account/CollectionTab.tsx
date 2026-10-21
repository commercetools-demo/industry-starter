'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Icon, { type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { todayHours } from '@/lib/hours';
import { formatMoney } from '@/lib/utils';
import type { Money } from '@/lib/types';

/**
 * Collection tab (US market only; the page answers 404 in Canada). The saved store is the session's `collectionStoreKey`
 * (per browser, 30 days, Q-L-11); "Change store" opens the picker and the choice updates availability site-wide. The tiles
 * read the store's minutes and the promise figures' threshold; a figure that is missing hides its tile. There is no loyalty
 * tile and no in-store returns tile (Q-L-06, D-001).
 */
export default function CollectionTab({ freeShippingThreshold }: { freeShippingThreshold: Money | null }) {
  const t = useTranslations('account.collection');
  const tp = useTranslations('store.picker');
  const tPanel = useTranslations('account.panel');
  const locale = useLocale();
  const { store, stores, isLoading, error, retry, open } = useCollectionStore();
  const [now] = useState(() => new Date());
  const hours = store ? todayHours(store, now, store.timeZone) : null;

  const tiles: { icon: IconName; title: string; text: string; href?: string }[] = [];
  if (store?.collectionMinutes) {
    tiles.push({ icon: 'clock', title: t('tile.fast'), text: t('tile.fastText', { minutes: store.collectionMinutes }) });
  }
  if (freeShippingThreshold) {
    tiles.push({
      icon: 'truck',
      title: t('tile.shipping'),
      text: t('tile.shippingText', { threshold: formatMoney(freeShippingThreshold.centAmount, freeShippingThreshold.currencyCode, locale) }),
    });
  }
  tiles.push({ icon: 'repeat', title: t('tile.subscribe'), text: t('tile.subscribeText'), href: '/account/subscriptions' });

  return (
    <section aria-labelledby="collection-heading">
      <h2 id="collection-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <Card data-testid="collection-store">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-field bg-canvas-2 text-ink">
            <Icon name="store" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            {store ? (
              <>
                <p className="m-0 font-display text-[17px] font-bold text-ink">{store.name}</p>
                <p className="m-0 text-[14px] text-ink-2">
                  {store.addressLine}, {store.city} {store.postalCode}
                </p>
                <p className="m-0 text-[14px] text-ink-2">
                  {hours ? tp('openToday', { open: hours.open, close: hours.close }) : tp('closedToday')}
                </p>
                {store.phone ? <p className="m-0 text-[14px] text-ink-2">{t('phone', { phone: store.phone })}</p> : null}
                <p className="mb-0 mt-2 text-[12.5px] text-ink-3">{t('help')}</p>
              </>
            ) : isLoading && stores.length === 0 ? (
              <p className="m-0 text-[14.5px] text-ink-3" role="status">
                {t('help')}
              </p>
            ) : error && stores.length === 0 ? (
              <p className="m-0 text-[14.5px] text-ink-2" role="alert">
                {t('unavailable')}{' '}
                <button type="button" onClick={() => void retry()} className="border-0 bg-transparent p-0 font-semibold text-ink underline">
                  {tPanel('retry')}
                </button>
              </p>
            ) : (
              <p className="m-0 text-[14.5px] text-ink-2">{t('none')}</p>
            )}
          </div>
          <Button variant="ghost" onClick={() => open()}>
            {store ? t('change') : t('chooseStore')}
          </Button>
        </div>
      </Card>

      <ul className="m-0 mt-5 grid list-none gap-4 p-0 xs:grid-cols-2 grid3:grid-cols-3" data-testid="collection-tiles">
        {tiles.map((tile) => (
          <li key={tile.title}>
            <Card className="h-full p-5">
              <Icon name={tile.icon} size={22} className="text-accent-press" />
              <p className="m-0 mt-3 font-display text-[15px] font-semibold text-ink">
                {tile.href ? (
                  <Link href={tile.href} className="text-ink underline-offset-2 hover:underline">
                    {tile.title}
                  </Link>
                ) : (
                  tile.title
                )}
              </p>
              <p className="m-0 mt-1 text-[13.5px] text-ink-2">{tile.text}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
