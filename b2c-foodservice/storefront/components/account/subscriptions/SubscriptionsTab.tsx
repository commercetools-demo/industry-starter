'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import PendingSubscriptionCard from './PendingSubscriptionCard';
import SubscriptionCard from './SubscriptionCard';
import SubscriptionsSkeleton from './SubscriptionsSkeleton';

/** The Subscriptions tab: loading, error with retry, empty with a way to shop, pending and one card per subscription. */
export default function SubscriptionsTab() {
  const t = useTranslations('subscription.account');
  const { subscriptions, pending, isLoading, error, mutate } = useSubscriptions();
  const hasData = subscriptions.length > 0 || pending.length > 0;

  return (
    <section aria-labelledby="subscriptions-heading">
      <h2 id="subscriptions-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      {isLoading && !hasData ? (
        <SubscriptionsSkeleton />
      ) : error && !hasData ? (
        <Card role="alert" data-testid="subscriptions-error">
          <p className="m-0 mb-3 text-[14.5px] text-ink-2">{t('error')}</p>
          <Button variant="ghost" onClick={() => void mutate()}>
            {t('retry')}
          </Button>
        </Card>
      ) : !hasData ? (
        <Card data-testid="subscriptions-empty">
          <span className="text-ink-2"><Icon name="repeat" size={24} /></span>
          <p className="m-0 mt-2 font-display text-[17px] font-semibold text-ink">{t('empty.title')}</p>
          <p className="m-0 mb-4 mt-1 text-[14.5px] text-ink-2">{t('empty.text')}</p>
          <ButtonLink href="/shop">{t('empty.cta')}</ButtonLink>
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('list')}>
          {pending.map((p) => (
            <li key={p.orderId}>
              <PendingSubscriptionCard pending={p} />
            </li>
          ))}
          {subscriptions.map((s) => (
            <li key={s.id}>
              <SubscriptionCard subscription={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
