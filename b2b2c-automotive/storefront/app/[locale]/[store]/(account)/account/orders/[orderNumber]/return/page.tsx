// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageTitle, StateMessage } from '@/components/account/Panel';
import { ReturnForm } from '@/components/account/ReturnForm';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { isAppLocale } from '@/i18n/config';
import { loadAccountOrder } from '@/lib/ct/account-order-page';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; store: string; orderNumber: string }> };

/** Request a return (workstream Q-07). When the order is not eligible the page says why instead of showing the form. */
export default async function ReturnPage({ params }: Props) {
  const { locale, store, orderNumber } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound();
  const loaded = await loadAccountOrder(store, locale, session.customerId, orderNumber);
  if (!loaded) notFound();
  const t = await getTranslations({ locale, namespace: 'account.return' });
  const to = await getTranslations({ locale, namespace: 'account.order' });
  const { eligibility } = loaded;
  const reason = eligibility.problem === 'window-closed' ? to('returnClosed') : eligibility.problem === 'nothing-left' ? to('returnNothingLeft') : to('returnNotDelivered');
  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      {eligibility.eligible ? (
        <ReturnForm store={store} orderNumber={loaded.view.number} lines={eligibility.lines} deadline={eligibility.deadline} timeZone={loaded.view.timezone} />
      ) : (
        <StateMessage
          kind="empty"
          title={t('notEligibleTitle')}
          hint={<p className="m-0 font-ui text-sm text-text-body">{reason}</p>}
          action={
            <Link href={`/${store}/account/orders/${loaded.view.number}`} className={buttonClass('secondary')}>
              {t('backToOrder')}
            </Link>
          }
        />
      )}
    </div>
  );
}
