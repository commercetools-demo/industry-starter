'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { contactHref } from '@/lib/routes';
import type { PendingSubscription } from '@/lib/types';

/** An order whose subscription is not there yet. The order itself is never affected. */
export default function PendingSubscriptionCard({ pending }: { pending: PendingSubscription }) {
  const t = useTranslations('subscription.account');
  return (
    <Card as="article" className="p-5" data-testid="pending-subscription" role="status">
      <div className="flex items-start gap-3">
        <span className="text-ink-2"><Icon name="repeat" size={20} /></span>
        <div>
          <h3 className="m-0 font-display text-[16px] font-semibold text-ink">{t('pending.title')}</h3>
          <p className="m-0 mt-1 text-[14px] text-ink-2">{t('pending.text', { orderNumber: pending.orderNumber ?? '' })}</p>
          <Link href={contactHref()} className="mt-2 inline-block text-[13.5px] font-medium text-ink underline underline-offset-2">
            {t('contact')}
          </Link>
        </div>
      </div>
    </Card>
  );
}
