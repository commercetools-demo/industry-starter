import { getTranslations, setRequestLocale } from 'next-intl/server';
import Card from '@/components/ui/Card';
import ButtonLink from '@/components/ui/ButtonLink';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/** Subscriptions tab: a stub with an explicit empty state. Workstream N replaces the body; the guard and the shell stay. */
export default async function AccountSubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/subscriptions');
  const t = await getTranslations('account.subscriptions');
  return (
    <section aria-labelledby="subscriptions-heading">
      <h2 id="subscriptions-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <Card>
        <p className="m-0 mb-4 text-[14.5px] text-ink-2">{t('stub')}</p>
        <ButtonLink href="/shop">{t('cta')}</ButtonLink>
      </Card>
    </section>
  );
}
