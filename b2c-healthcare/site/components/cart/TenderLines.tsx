import { useLocale, useTranslations } from 'next-intl';
import { formatIsoDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/utils';
import type { Money, TenderView } from '@/lib/types';

/**
 * How the amount owed would be paid, in tender order (allowance, restricted instrument, card). Every figure is the
 * server's (`TenderView`); nothing is added here. Shown on the cart and in the checkout summary.
 */
export function TenderLines({ tender }: { tender: TenderView }) {
  const t = useTranslations('funding.tender');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);
  const { allowance, restricted } = tender;
  const showRestricted = restricted.eligibleSubtotal.centAmount > 0 || !restricted.available;
  return (
    <div className="grid gap-2 border-t border-border pt-3 text-sm" data-tender>
      {allowance ? (
        <div className="grid gap-1" data-tender-allowance>
          <div className="flex items-center justify-between">
            <span>{t('allowanceBalance')}</span>
            <b data-allowance-balance>{money(allowance.balance)}</b>
          </div>
          {allowance.applies.centAmount > 0 ? (
            <div className="flex items-center justify-between">
              <span>{t('allowanceWouldUse')}</span>
              <b data-allowance-applies>{money(allowance.applies)}</b>
            </div>
          ) : null}
          {allowance.balance.centAmount > 0 ? <p className="text-neutral-600">{t('forfeits', { date: formatIsoDate(allowance.forfeitsOn, locale) })}</p> : null}
        </div>
      ) : null}
      {showRestricted ? (
        <div className="grid gap-1" data-tender-restricted={restricted.available ? 'available' : 'unavailable'}>
          <div className="flex items-center justify-between">
            <span>{t('eligibleSubtotal')}</span>
            <b data-eligible-subtotal>{money(restricted.eligibleSubtotal)}</b>
          </div>
          {restricted.available ? null : <p className="text-neutral-600">{t('restrictedUnavailable')}</p>}
          {restricted.available && tender.needsOtherTender.centAmount > 0 ? (
            <div className="flex items-center justify-between">
              <span>{t('needsOther')}</span>
              <b data-needs-other-tender>{money(tender.needsOtherTender)}</b>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <span>{t('cardPays')}</span>
        {tender.card.centAmount === 0 ? <b data-card-amount="none">{t('noCard')}</b> : <b data-card-amount="due">{money(tender.card)}</b>}
      </div>
    </div>
  );
}
