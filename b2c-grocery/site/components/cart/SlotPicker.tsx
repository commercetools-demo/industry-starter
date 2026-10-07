'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import type { useDeliveryMutations } from '@/hooks/useDelivery';
import { useSlots } from '@/hooks/useDelivery';
import { isSlotActive } from '@/lib/cart-rules';
import type { Slot } from '@/lib/slots/types';
import type { Cart } from '@/lib/types';

type Mutations = ReturnType<typeof useDeliveryMutations>;

const pad = (n: number) => String(n).padStart(2, '0');
/** "10:00-12:00" (the stub works in UTC). */
export const windowLabel = (slot: { start: string; end: string }): string =>
  `${pad(new Date(slot.start).getUTCHours())}:00–${pad(new Date(slot.end).getUTCHours())}:00`;
export const dayLabel = (date: string, locale: string, style: 'short' | 'long' = 'short'): string =>
  new Intl.DateTimeFormat(locale, { weekday: style, day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

/** Day tabs and radio cards for the bookable windows; the chosen slot lives on the cart. */
export function SlotPicker({
  cart,
  address,
  mutations,
  onNotice,
}: {
  cart: Cart;
  address: { country: string; postalCode: string };
  mutations: Mutations;
  onNotice: (message: string | null) => void;
}) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { data, error, isLoading, mutate } = useSlots(address);
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const active = isSlotActive(cart.slot) ? cart.slot : undefined;
  const days = useMemo(() => data?.days ?? [], [data]);
  const activeDate = active?.start.slice(0, 10);
  const day = useMemo(() => {
    const usable = (date: string | null | undefined) => days.find((d) => d.date === date && d.slots.length > 0);
    return usable(dayChoice) ?? usable(activeDate) ?? days.find((d) => d.slots.length > 0);
  }, [days, dayChoice, activeDate]);

  const pick = async (slot: Slot) => {
    if (busy || active?.id === slot.id) return;
    setBusy(true);
    setProblem(null);
    onNotice(null);
    const result = await mutations.pickSlot(slot.id);
    setBusy(false);
    if (result.ok) return;
    if (result.error === 'SLOT_FULL') {
      if (result.slots) await mutate(result.slots, { revalidate: false });
      else await mutate();
      setProblem(t('slotTaken'));
    } else {
      setProblem(t('step.slotFailed'));
    }
  };

  const release = async () => {
    setBusy(true);
    await mutations.clearSlot();
    setBusy(false);
  };

  if (isLoading) return <p aria-busy="true" className="m-0 text-[14px] text-muted">{t('step.slotsLoading')}</p>;
  if (error || !data) return <p role="alert" className="m-0 text-[14px] text-accent-700">{t('step.slotsFailed')}</p>;

  const hasCapacity = days.some((d) => d.slots.length > 0);
  return (
    <div className="flex flex-col gap-(--space-3)">
      <h3 className="m-0 text-[18px]">{t('step.slotsTitle')}</h3>
      {problem ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700">
          {problem}
        </p>
      ) : null}
      {!active && cart.slot ? (
        <p role="status" className="m-0 text-[14px] text-muted">
          {t('slotExpired')}
        </p>
      ) : null}
      {hasCapacity && day ? (
        <>
          <Segmented
            label={t('step.daysLabel')}
            value={day.date}
            onChange={setDayChoice}
            options={days.map((d) => ({ value: d.date, label: dayLabel(d.date, locale), disabled: d.slots.length === 0 }))}
          />
          <div role="radiogroup" aria-label={t('step.timesLabel')} className="grid gap-(--space-2) tablet:grid-cols-2">
            {day.slots.map((slot) => (
              <label
                key={slot.id}
                className="flex cursor-pointer items-center justify-between gap-(--space-3) rounded-[var(--radius-md)] border border-divider px-(--space-4) py-(--space-3) text-[15px] has-checked:border-accent has-checked:bg-accent-100 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
              >
                <span className="flex items-center gap-(--space-2)">
                  <input type="radio" name="delivery-slot" value={slot.id} checked={active?.id === slot.id} disabled={busy} onChange={() => void pick(slot)} />
                  {windowLabel(slot)}
                </span>
                <span className="text-[13px] text-muted">{t('step.slotsLeft', { count: slot.remaining })}</span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div role="status" className="flex flex-col gap-(--space-1) text-[15px]">
          <p className="m-0">{t('noSlots')}</p>
          {data.nextAvailableDate ? <p className="m-0 text-muted">{t('nextAvailable', { date: dayLabel(data.nextAvailableDate, locale, 'long') })}</p> : null}
        </div>
      )}
      {active ? (
        <Button variant="ghost" className="self-start" disabled={busy} onClick={() => void release()}>
          {t('step.release')}
        </Button>
      ) : null}
    </div>
  );
}
