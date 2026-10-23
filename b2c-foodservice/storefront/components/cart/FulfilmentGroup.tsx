'use client';

import type { Cart, CartGroup } from '@/lib/types';
import CartLineRow from './CartLineRow';
import GroupHeading from './GroupHeading';
import { linesOf, type CartUi } from './use-cart-ui';

/**
 * One fulfilment cluster on the cart page: a heading with the store, delivery or subscription promise, then its lines.
 * Collect clusters exist per store; a cluster with no lines is never rendered.
 */
export default function FulfilmentGroup({ cart, group, ui }: { cart: Cart; group: CartGroup; ui: CartUi }) {
  const lines = linesOf(cart, group.lineIds);
  if (lines.length === 0) return null;
  return (
    <section data-group={group.key} className="mb-8 rounded-card border border-line bg-surface px-5 pb-1 pt-5 mobile:px-7">
      <GroupHeading level={2} group={group} freeShipping={cart.freeShipping} onChangeStore={group.kind === 'collect' ? ui.openStoreChange : undefined} />
      <ul className="m-0 mt-2 list-none p-0">
        {lines.map((line) => (
          <CartLineRow key={line.id} line={line} ui={ui} />
        ))}
      </ul>
    </section>
  );
}
