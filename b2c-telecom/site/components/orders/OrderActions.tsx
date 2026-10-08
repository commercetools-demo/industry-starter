import type { ReactElement, ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { cancelEligibility, returnEligibility } from '@/lib/orders/postPurchaseRules';
import type { Locale, Order } from '@/lib/types';
import { CancelOrderDialog, type EtfRow } from './CancelOrderDialog';
import { ReturnRequestDialog } from './ReturnRequestDialog';

/** `March 12, 2026` / `12. März 2026`: long form, in UTC so a date-only value never shifts with the viewer's time zone. */
function longDate(value: string, locale: Locale): string {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

function Box({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-7" data-print="hide">
      {children}
    </div>
  );
}

/** The early-termination fee text of every plan line, as stored on the order's label. */
function etfRowsOf(order: Order): EtfRow[] {
  return order.lines.flatMap((line) => {
    const fee = order.etfByLine[line.id];
    return fee !== undefined && (line.kind === 'internet-plan' || line.kind === 'phone-plan') ? [{ lineId: line.id, name: line.name, fee }] : [];
  });
}

/**
 * What the buyer can still do with this order: cancel it until its service starts, return a device within 30 days. The decision is made
 * here with the same pure rules the server applies again on every write. `nowIso` comes from the server so both sides agree.
 */
export function OrderActions({ order, nowIso }: { order: Order; nowIso?: string }): ReactElement | null {
  const t = useTranslations('orders');
  const locale = useLocale() as Locale;
  const now = nowIso ? new Date(nowIso) : new Date();
  const cancel = cancelEligibility(order, now);
  const showCancel = cancel.allowed || (cancel.block !== 'ALREADY_CANCELLED' && cancel.block !== 'ORDER_COMPLETE');
  const hasDevice = order.lines.some((line) => line.acquisition !== null);
  const giveBack = returnEligibility(order, now);
  const showReturn = hasDevice && !(!giveBack.allowed && giveBack.block === 'ORDER_CANCELLED');
  if (!showCancel && !showReturn) return null;

  return (
    <section aria-label={t('actions.title')} className="flex w-full flex-col gap-5">
      {showCancel ? (
        <Box>
          {cancel.allowed ? (
            <>
              <p className="m-0 text-md">{t('cancel.until', { date: longDate(cancel.until, locale) })}</p>
              <CancelOrderDialog orderNumber={order.orderNumber} etfRows={etfRowsOf(order)} />
            </>
          ) : (
            <>
              <p className="m-0 text-md">{t(`cancel.block.${cancel.block as 'SERVICE_STARTED'}`)}</p>
              <Button variant="ghost" href="/support">
                {t('cancel.contact')}
              </Button>
            </>
          )}
        </Box>
      ) : null}
      {showReturn ? (
        <Box>
          {giveBack.allowed ? (
            <>
              <p className="m-0 text-md">{t('return.until', { date: longDate(giveBack.until, locale) })}</p>
              <ReturnRequestDialog orderNumber={order.orderNumber} lines={giveBack.lines} />
            </>
          ) : (
            <p className="m-0 text-md">{t(`return.block.${giveBack.block as 'WINDOW_CLOSED'}`)}</p>
          )}
        </Box>
      ) : null}
    </section>
  );
}
