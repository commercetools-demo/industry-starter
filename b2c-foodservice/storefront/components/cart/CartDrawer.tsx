'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import ButtonLink from '@/components/ui/ButtonLink';
import Button from '@/components/ui/Button';
import Drawer from '@/components/ui/Drawer';
import { useShellUi } from '@/context/shell-ui-context';
import { useCart } from '@/hooks/useCart';
import type { Cart } from '@/lib/types';
import DrawerLine from './DrawerLine';
import DroppedLinesNotice from './DroppedLinesNotice';
import EmptyCart from './EmptyCart';
import FreeShippingProgress from './FreeShippingProgress';
import GroupHeading from './GroupHeading';
import { linesOf, useCartUi, useMoney } from './use-cart-ui';

function Skeleton() {
  const t = useTranslations('cart.drawer');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-4 py-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3.5">
          <div className="h-[100px] w-[84px] animate-pulse rounded-field bg-canvas-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded-pill bg-canvas-2" />
            <div className="h-3 w-1/2 animate-pulse rounded-pill bg-canvas-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Why checkout is not offered, as a message key under `cart.blocker`. */
export function blockerKey(cart: Cart): 'outOfStock' | 'collectUnavailable' | 'priceUnavailable' | null {
  if (cart.blockers.includes('out-of-stock')) return 'outOfStock';
  if (cart.blockers.includes('collect-unavailable')) return 'collectUnavailable';
  if (cart.blockers.includes('price-unavailable')) return 'priceUnavailable';
  return null;
}

function Footer({ cart, onClose }: { cart: Cart; onClose: () => void }) {
  const t = useTranslations('cart');
  const money = useMoney();
  const belowMinimum = cart.blockers.includes('below-minimum') && cart.minimumOrder.shortfall && cart.minimumOrder.value;
  const reason = blockerKey(cart);
  const disabled = !cart.canCheckout;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[15px] font-semibold">
        <span>{t('drawer.subtotal')}</span>
        <span data-testid="drawer-subtotal">{money(cart.subtotal)}</span>
      </div>
      <ButtonLink href="/cart" size="lg" block onClick={onClose}>
        {t('drawer.view')}
      </ButtonLink>
      {belowMinimum ? (
        <p role="status" className="m-0 rounded-field bg-amber/25 px-3.5 py-3 text-[13px] text-ink">
          {t('minimum.shortfall', { shortfall: money(cart.minimumOrder.shortfall!), minimum: money(cart.minimumOrder.value!) })}
        </p>
      ) : (
        <>
          <ButtonLink
            href="/checkout"
            variant="ghost"
            size="lg"
            block
            aria-disabled={disabled || undefined}
            onClick={(e) => {
              if (disabled) e.preventDefault();
              else onClose();
            }}
          >
            {t('drawer.checkout')}
          </ButtonLink>
          {disabled && reason ? (
            <p role="status" className="m-0 text-center text-[12.5px] text-ink-3">
              {t(`blocker.${reason}`)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The bag drawer, mounted once in the locale layout (workstream I, spec `design-cart-drawer`). Opened by the header cart
 * button; the cart is read when it opens. Lines sit inside their fulfilment cluster (collect per store, shipping,
 * subscriptions) and each carries a fulfilment mark (D-033). Totals are the engine's, from each response.
 */
export default function CartDrawer() {
  const t = useTranslations('cart.drawer');
  const { cartOpen, closeCart, registerCartDrawer } = useShellUi();
  const { cart, isLoading, error, mutate } = useCart({ enabled: cartOpen });
  const ui = useCartUi();

  useEffect(() => {
    registerCartDrawer(true);
    return () => registerCartDrawer(false);
  }, [registerCartDrawer]);

  const empty = cart !== null && cart.lines.length === 0;
  const body = (() => {
    if (isLoading) return <Skeleton />;
    if (!cart && error) {
      return (
        <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="m-0 text-[14px]">{t('loadError')}</p>
          <Button variant="ghost" onClick={() => void mutate()}>
            {t('retry')}
          </Button>
        </div>
      );
    }
    if (!cart || empty) return <EmptyCart variant="drawer" onNavigate={closeCart} />;
    return (
      <>
        <div className="mt-2">
          <FreeShippingProgress freeShipping={cart.freeShipping} />
        </div>
        {cart.groups.map((group) => (
          <section key={group.key} aria-label={group.key}>
            <GroupHeading group={group} freeShipping={cart.freeShipping} compact />
            <ul className="m-0 list-none p-0">
              {linesOf(cart, group.lineIds).map((line) => (
                <DrawerLine key={line.id} line={line} ui={ui} onNavigate={closeCart} />
              ))}
            </ul>
          </section>
        ))}
      </>
    );
  })();

  return (
    <Drawer
      open={cartOpen}
      onClose={closeCart}
      title={t('title', { count: cart?.count ?? 0 })}
      footer={cart && cart.lines.length > 0 ? <Footer cart={cart} onClose={closeCart} /> : undefined}
    >
      <div data-cart-root>
        <DroppedLinesNotice />
        {ui.message ? (
          <p role="status" data-testid="cart-message" className="mb-2 mt-3 rounded-field bg-canvas-2 px-3.5 py-2.5 text-[13px] text-ink">
            {ui.message}
          </p>
        ) : null}
        {body}
      </div>
    </Drawer>
  );
}
