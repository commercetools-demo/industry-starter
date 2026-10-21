'use client';

import { useTranslations } from 'next-intl';
import Breadcrumbs from '@/components/listing/Breadcrumbs';
import Button from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import type { Cart } from '@/lib/types';
import CompanionNudge from './CompanionNudge';
import DroppedLinesNotice from './DroppedLinesNotice';
import EmptyCart from './EmptyCart';
import FulfilmentGroup from './FulfilmentGroup';
import OrderSummary from './OrderSummary';
import { useCartUi } from './use-cart-ui';

function PageSkeleton() {
  const t = useTranslations('cart.drawer');
  return (
    <div role="status" aria-label={t('loading')} className="grid gap-12 stack:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
      <div className="h-72 animate-pulse rounded-card bg-canvas-2" />
      <div className="h-72 animate-pulse rounded-card bg-canvas-2" />
    </div>
  );
}

/**
 * `/cart`: the bag in fulfilment clusters (collect per store, shipping, subscriptions) with the order summary beside it.
 * `initialCart` comes from the server render so there is no spinner; SWR keeps it fresh after that. Every figure shown
 * is the engine's, read back after each write.
 */
export default function CartPage({ initialCart }: { initialCart?: Cart | null }) {
  const t = useTranslations('cart');
  const { cart, isLoading, error, mutate } = useCart(initialCart === undefined ? {} : { initialCart });
  const ui = useCartUi();

  const crumbs = [{ label: t('page.home'), href: '/' }, { label: t('page.breadcrumb') }];

  if (isLoading) {
    return (
      <div className="wrap pb-20 pt-6">
        <Breadcrumbs items={crumbs} />
        <h1 className="page-title m-0 mb-8 mt-4">{t('page.title')}</h1>
        <PageSkeleton />
      </div>
    );
  }
  if (!cart && error) {
    return (
      <div className="wrap pb-20 pt-6">
        <Breadcrumbs items={crumbs} />
        <h1 className="page-title m-0 mb-8 mt-4">{t('page.title')}</h1>
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0">{t('page.loadError')}</p>
          <Button variant="ghost" onClick={() => void mutate()}>
            {t('drawer.retry')}
          </Button>
        </div>
      </div>
    );
  }
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="wrap pb-20 pt-6" data-cart-root>
        <Breadcrumbs items={crumbs} />
        <DroppedLinesNotice />
        <EmptyCart variant="page" />
      </div>
    );
  }

  return (
    <div className="wrap pb-20 pt-6" data-cart-root>
      <Breadcrumbs items={crumbs} />
      <h1 className="page-title m-0 mb-8 mt-4">{t('page.title')}</h1>
      <DroppedLinesNotice />
      {ui.message ? (
        <p role="status" data-testid="cart-message" className="mb-5 rounded-field bg-canvas-2 px-4 py-3 text-[13.5px] text-ink">
          {ui.message}
        </p>
      ) : null}
      <div className="grid items-start gap-12 stack:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <div>
          {cart.groups.map((group) => (
            <FulfilmentGroup key={group.key} cart={cart} group={group} ui={ui} />
          ))}
        </div>
        <div>
          <CompanionNudge nudge={cart.nudge} />
          <OrderSummary cart={cart} ui={ui} />
        </div>
      </div>
    </div>
  );
}
