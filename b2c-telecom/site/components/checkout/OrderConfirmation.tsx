import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { OrderLines } from '@/components/account/OrderLines';
import { OrderTotals } from '@/components/account/OrderTotals';
import { PrintReceiptButton } from '@/components/account/PrintReceiptButton';
import '@/components/account/receipt.css';
import { PriceSchedule } from '@/components/bundle/PriceSchedule';
import { Button } from '@/components/ui/Button';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import { confirmationFacts, type BannerState } from '@/lib/checkout/confirmationView';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import type { Locale, OrderConfirmationView } from '@/lib/types';

const TONE: Record<BannerState, TagTone> = { Open: 'pink', Confirmed: 'brand', Complete: 'brand', Cancelled: 'danger' };
const H2 = 'm-0 font-display text-2xl font-bold tracking-ui';
const LINK = cx('font-display text-md font-semibold underline underline-offset-4', FOCUS_RING);

/**
 * The order as it was stored (never the cart): the banner tells the order's TRUE state, the figures are the order's recorded prices.
 * Junior design choice (D-068): undrawn; a pink-50 banner, the account's order components for the lines and totals, a "what happens next"
 * list. The owner (and the session that placed the order) sees everything; anyone else with the number sees reference, state, lines and totals.
 */
export function OrderConfirmation({ view, now }: { view: OrderConfirmationView; now: Date }): ReactElement {
  const t = useTranslations('confirmation');
  const locale = useLocale() as Locale;
  const { order } = view;
  const facts = confirmationFacts(view, now);
  const schedules = order.schedules.filter((schedule) => schedule.status === 'active');
  const physical = order.lines.some((line) => line.kind === 'equipment' || line.kind === 'device');
  const address = order.shippingAddress;
  const start = formatDate(order.serviceStartDate, locale);

  return (
    <div className="receipt-page flex flex-col gap-9">
      <section aria-labelledby="confirmation-heading" className={cx('flex flex-col gap-3 rounded-xl p-7', facts.banner === 'Cancelled' ? 'border-2 border-danger bg-surface' : 'bg-pink-50')}>
        <div className="flex flex-wrap items-center gap-4">
          <h2 id="confirmation-heading" className="m-0 font-display text-3xl font-bold tracking-ui">
            {t(`heading.${facts.banner}`)}
          </h2>
          <Tag tone={TONE[facts.banner]}>{t(`state.${facts.banner}`)}</Tag>
          {facts.payment ? <span className="text-sm text-text-muted">{t(`payment.${facts.payment}`)}</span> : null}
        </div>
        <p className="m-0 text-md">{t(`sentence.${facts.banner}`, { orderNumber: order.orderNumber })}</p>
        {facts.showPrivate && view.email ? <p className="m-0 text-sm text-text-muted">{t('contact', { email: view.email })}</p> : null}
        {!facts.showPrivate ? <p className="m-0 text-sm text-text-muted">{t('limited', { orderNumber: order.orderNumber })}</p> : null}
      </section>

      <section aria-labelledby="confirmation-summary" className="flex flex-col gap-5">
        <h2 id="confirmation-summary" className={H2}>
          {t('summary')}
        </h2>
        <OrderLines order={order} />
        <OrderTotals order={order} />
      </section>

      {facts.showPrivate ? (
        <section aria-labelledby="confirmation-service" className="flex flex-col gap-3">
          <h2 id="confirmation-service" className={H2}>
            {t('service')}
          </h2>
          <p className="m-0 text-md font-semibold">{t('serviceStart', { date: start })}</p>
          {address ? (
            <div className="flex flex-col text-md">
              <span className="font-display text-sm font-semibold">{t('serviceAddress')}</span>
              <span>{address.name}</span>
              <span>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
              </span>
              <span>
                {address.city}
                {address.state ? `, ${address.state}` : ''} {address.postalCode}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {facts.showPrivate && schedules.length > 0 ? (
        <section aria-labelledby="confirmation-schedule" className="flex flex-col gap-5">
          <h2 id="confirmation-schedule" className={H2}>
            {t('schedule')}
          </h2>
          {schedules.map((schedule) => (
            <PriceSchedule key={schedule.sku} schedule={schedule} locale={locale} />
          ))}
          {facts.showAccountLinks ? (
            <Link href={`/account/orders/${order.orderNumber}`} className={LINK}>
              {t('viewLabels')}
            </Link>
          ) : null}
        </section>
      ) : null}

      {facts.showPrivate ? (
        <section aria-labelledby="confirmation-next" className="flex flex-col gap-3">
          <h2 id="confirmation-next" className={H2}>
            {t('next.title')}
          </h2>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-6 text-md">
            <li>{t('next.start', { date: start })}</li>
            {physical ? <li>{t('next.ships')}</li> : null}
            {facts.showCancelSentence ? (
              <li>
                {t('next.cancel', { date: start })}{' '}
                <Link href={`/account/orders/${order.orderNumber}`} className="underline underline-offset-4">
                  {t('next.manage')}
                </Link>
              </li>
            ) : null}
            <li>
              <Link href="/support" className="underline underline-offset-4">
                {t('next.support')}
              </Link>
            </li>
          </ul>
          {facts.showGuestKeep ? (
            <p className="m-0 text-md font-semibold">
              {t('guest.keep', { orderNumber: order.orderNumber })}{' '}
              <Link href="/register" className="underline underline-offset-4">
                {t('createAccount')}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <div data-print="hide" className="flex flex-wrap gap-4">
        {facts.showPrivate ? <PrintReceiptButton /> : null}
        {facts.showAccountLinks ? <Button href={`/account/orders/${order.orderNumber}`}>{t('viewOrder')}</Button> : null}
        <Button href="/shop/phone-plans" variant="secondary">
          {t('continue')}
        </Button>
        {facts.showAccountLinks ? (
          <Button href="/account/orders" variant="ghost">
            {t('history')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
