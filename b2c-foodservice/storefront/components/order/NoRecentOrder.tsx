import { getTranslations } from 'next-intl/server';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';

/** "No recent order": a missing id, an unknown id and an unreadable order all land here (HTTP 200, no detail about why). */
export default async function NoRecentOrder({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'order.none' });
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center gap-4 px-5 py-24 text-center" data-testid="no-recent-order">
      <span className="text-ink-3">
        <Icon name="bag" size={44} />
      </span>
      <h1 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">{t('title')}</h1>
      <p className="m-0 text-[15px] text-ink-3">{t('body')}</p>
      <ButtonLink href="/shop" size="lg">
        {t('cta')}
      </ButtonLink>
    </div>
  );
}
