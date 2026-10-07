import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import type { AddressView } from '@/lib/types';

/** One card of the summary row: a small caps label and its content. */
export function SummaryCard({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-7">
      <h2 className="m-0 font-display text-xs font-semibold uppercase tracking-ui text-text-muted">{label}</h2>
      {children}
    </section>
  );
}

type SummaryCardsProps = {
  email: string;
  /** `null` when the customer has no account number (shown as an em dash). */
  customerNumber: string | null;
  /** The default shipping address; `null` = none saved. */
  address: AddressView | null;
  /** The monthly bill card (an async panel inside its own Suspense: it may fail without taking the others down). */
  bill: ReactNode;
};

const LINK = cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING);

/** ACCOUNT, MONTHLY BILL, DELIVERY ADDRESS and the honey "Want to change something?" card. */
export function SummaryCards({ email, customerNumber, address, bill }: SummaryCardsProps): ReactElement {
  const t = useTranslations('account');
  return (
    <div className="grid gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18.75rem),1fr))]">
      <SummaryCard label={t('card.account')}>
        <p className="m-0 break-words font-display text-lg font-semibold">{email}</p>
        <p className="m-0 text-md text-text-muted">{t('accountNo', { number: customerNumber ?? '—' })}</p>
      </SummaryCard>
      {bill}
      <SummaryCard label={t('card.address')}>
        {address ? (
          <>
            <address className="m-0 flex flex-col text-md not-italic">
              {address.name ? <span className="font-display font-semibold">{address.name}</span> : null}
              <span>{address.line1}</span>
              {address.line2 ? <span>{address.line2}</span> : null}
              <span>{[address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ')}</span>
            </address>
            <Link href="/account/addresses" className={LINK}>
              {t('address.manage')}
            </Link>
          </>
        ) : (
          <>
            <p className="m-0 text-md">{t('address.none')}</p>
            <Link href="/account/addresses" className={LINK}>
              {t('address.add')}
            </Link>
          </>
        )}
      </SummaryCard>
      <section aria-label={t('change.title')} className="flex min-w-0 flex-col gap-5 rounded-xl bg-surface-brand p-7 text-text-on-brand">
        <h2 className="m-0 font-display text-xl font-bold">{t('change.title')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/shop/phone-plans" variant="dark">
            {t('change.browse')}
          </Button>
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
