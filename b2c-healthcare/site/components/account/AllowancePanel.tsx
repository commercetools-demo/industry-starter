import { useLocale, useTranslations } from 'next-intl';
import { AccountHeading } from '@/components/account/AccountShell';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatIsoDate } from '@/lib/format-date';
import type { AllowanceView } from '@/lib/funding/allowance-types';
import { formatMoney } from '@/lib/utils';

/**
 * `/account/allowance` (benefit-allowance-drawdown): the member's balance for this cycle, what will be forfeited at
 * the end of it and when, and what was forfeited from the last one. Every figure comes from the cycle object on the
 * server. The page offers no action: an allowance is spent only by an order, drawn before any other payment, and
 * cannot be withdrawn or transferred (it says so).
 */
export function AllowancePanel({ view }: { view: AllowanceView | null | undefined }) {
  const t = useTranslations('allowance');
  const locale = useLocale();
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);
  return (
    <>
      <AccountHeading title={t('title')} />
      {view === undefined ? (
        <Card role="alert" className="text-danger-700" data-allowance-error>
          {t('loadFailed')}
        </Card>
      ) : view === null ? (
        <Card data-allowance-none>
          <p className="text-neutral-600">{t('none')}</p>
        </Card>
      ) : (
        <div className="grid gap-4" data-allowance>
          <Card className="grid gap-3">
            <p className="text-neutral-600">{t('sub')}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-neutral-600">{t('balance')}</dt>
              <dd className="text-xl font-bold text-navy-700" data-allowance-balance>
                {money(view.balance, view.currency)}
              </dd>
              <dt className="text-neutral-600">{t('granted', { cycle: view.cycle })}</dt>
              <dd data-allowance-granted>{money(view.granted, view.currency)}</dd>
              <dt className="text-neutral-600">{t('used')}</dt>
              <dd data-allowance-used>{money(view.consumed, view.currency)}</dd>
            </dl>
          </Card>
          <Card className="grid gap-2" data-allowance-forfeit>
            {view.lapsing > 0 ? (
              <p>
                <Badge variant="wait" className="mr-2">
                  {t('forfeitBadge')}
                </Badge>
                {t('forfeit', { amount: money(view.lapsing, view.currency), date: formatIsoDate(view.forfeitsOn, locale) })}
              </p>
            ) : (
              <p className="text-neutral-600" data-allowance-nothing-lapsing>
                {t('nothingLapsing', { date: formatIsoDate(view.forfeitsOn, locale) })}
              </p>
            )}
            {view.lastLapsed ? (
              <p className="text-sm text-neutral-600" data-allowance-last-lapsed>
                {t('lastLapsed', { amount: money(view.lastLapsed.amount, view.currency), cycle: view.lastLapsed.cycle })}
              </p>
            ) : null}
          </Card>
          <p className="text-sm text-neutral-600" data-allowance-not-cash>
            {t('notCash')}
          </p>
        </div>
      )}
    </>
  );
}
