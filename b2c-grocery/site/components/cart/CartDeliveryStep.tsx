'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { useCartContext } from '@/context/CartProvider';
import { useDeliveryMutations, type AddressInput } from '@/hooks/useDelivery';
import { isDeliverable } from '@/lib/slots/deliverable';
import { DeliveryAddress } from './DeliveryAddress';
import { SlotPicker } from './SlotPicker';

const MAX_TIMEOUT = 2_147_483_647;

/** Cart card "Delivery" (D-036): address form, then the slot picker once a deliverable address is saved. */
export function CartDeliveryStep() {
  const t = useTranslations('cart');
  const { cart } = useCartContext();
  const mutations = useDeliveryMutations();
  const [notice, setNotice] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Re-render when the slot hold runs out so the picker stops showing it as chosen.
  const holdExpires = cart?.slot?.holdExpires;
  useEffect(() => {
    if (!holdExpires) return;
    const ms = Date.parse(holdExpires) - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(ms + 50, MAX_TIMEOUT));
    return () => clearTimeout(timer);
  }, [holdExpires]);

  if (!cart) return null;

  const saveAddress = async (address: AddressInput) => {
    setNotice(null);
    const result = await mutations.saveAddress(address);
    if (result.slotCleared) setNotice(t('slotCleared'));
    return result;
  };

  const address = cart.shippingAddress;
  const deliverable = address?.postalCode ? isDeliverable(address.country, address.postalCode) : false;
  return (
    <Card className="mb-(--space-6) flex flex-col gap-(--space-4) p-[26px]" aria-labelledby="cart-delivery-title">
      <h2 id="cart-delivery-title" className="m-0 text-[24px]">
        {t('step.title')}
      </h2>
      {notice ? (
        <p role="status" className="m-0 rounded-[var(--radius-md)] bg-accent-100 px-(--space-4) py-(--space-3) text-[14px] text-accent-800">
          {notice}
        </p>
      ) : null}
      <DeliveryAddress address={address} onSave={saveAddress} />
      {address && deliverable ? (
        <SlotPicker key={`${address.country}|${address.postalCode}`} cart={cart} address={{ country: address.country, postalCode: address.postalCode ?? '' }} mutations={mutations} onNotice={setNotice} />
      ) : null}
    </Card>
  );
}
