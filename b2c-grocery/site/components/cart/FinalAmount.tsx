import { useLocale, useTranslations } from 'next-intl';
import type { Money } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * Order detail: the amount recorded after weighing (order custom field `finalTotal`, type `order-final`)
 * next to the provisional total. Renders nothing while `final` is undefined.
 * "Final amount €X · difference +€Y" (difference = final - provisional, signed), or "No difference" when equal.
 */
export function FinalAmount({ provisional, final }: { provisional: Money; final?: Money }) {
  const t = useTranslations('pricing');
  const locale = useLocale();
  if (!final) return null;
  const delta = final.centAmount - provisional.centAmount;
  const sign = delta > 0 ? '+' : '-';
  const difference =
    delta === 0 ? t('noDifference') : t('difference', { delta: `${sign}${formatMoney(Math.abs(delta), final.currencyCode, locale)}` });
  return (
    <p className="m-0 text-[15px]" data-testid="final-amount">
      <strong>{t('finalAmount', { amount: formatMoney(final.centAmount, final.currencyCode, locale) })}</strong>
      <span className="text-muted"> · {difference}</span>
    </p>
  );
}
