'use client';

import Image from 'next/image';
import { useMemo, useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { MAX_DEVICE_QUANTITY } from '@/lib/config/devices';
import { cx } from '@/lib/cx';
import { quoteAcquisition } from '@/lib/devices/acquisition';
import { findVariant, initialChoice, normalizeChoice, type AcquisitionChoice } from '@/lib/devices/choice';
import { dayToDate } from '@/lib/devices/format';
import { deviceHeadline } from '@/lib/devices/headline';
import { formatMoneyExact } from '@/lib/format';
import { offerAnchorId } from '@/lib/listing/links';
import type { AddDeviceArgs, DeviceOffer, Locale } from '@/lib/types';
import { AcquisitionModePicker } from './AcquisitionModePicker';
import { AcquisitionSummary } from './AcquisitionSummary';
import { DevicePicker } from './DevicePicker';
import { useDeviceErrorText } from './useDeviceError';

type DeviceCardProps = {
  offer: DeviceOffer;
  /** `YYYY-MM-DD` of the request (the server's today), so the estimated dates match between server and browser. */
  today: string;
  highlighted?: boolean;
  /** Puts the line into the bundle. Rejects with the refusal of the route; the card shows it in words. */
  onAdd: (args: AddDeviceArgs) => Promise<void>;
};

/**
 * A handset (design undrawn: Junior design choice, D-068): name and the lowest prices, color and memory pickers, the three ways to pay
 * with what is due today and monthly, the end-of-term obligation, a quantity and "Add to bundle". Everything shown is computed from
 * the variant's prices; the server re-checks every add.
 */
export function DeviceCard({ offer, today, highlighted = false, onAdd }: DeviceCardProps): ReactElement | null {
  const t = useTranslations('devices');
  const tb = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const errorText = useDeviceErrorText(offer.name);
  const start = useMemo(() => initialChoice(offer), [offer]);

  const [color, setColor] = useState(start?.variant.color ?? '');
  const [memoryGb, setMemoryGb] = useState(start?.variant.memoryGb ?? 0);
  const [choice, setChoice] = useState<AcquisitionChoice>(start?.choice ?? { mode: 'outright', termMonths: 0 });
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = findVariant(offer, color, memoryGb) ?? start?.variant;
  const headline = useMemo(() => deviceHeadline(offer), [offer]);
  if (!variant) return null;

  const quote = quoteAcquisition(variant.prices, choice.mode, choice.termMonths, dayToDate(today), quantity);
  const stock = variant.availableQuantity;
  const soldOut = stock !== undefined && stock <= 0;
  const maxQuantity = Math.max(1, Math.min(MAX_DEVICE_QUANTITY, stock ?? MAX_DEVICE_QUANTITY));

  /** A new color or memory keeps the buyer's choice when the variant offers it, and otherwise moves it to what the variant offers. */
  const pick = (nextColor: string, nextMemory: number): void => {
    const next = findVariant(offer, nextColor, nextMemory);
    if (!next) return;
    setColor(nextColor);
    setMemoryGb(nextMemory);
    setChoice((current) => normalizeChoice(next.prices, current));
    setQuantity((current) => Math.min(current, Math.max(1, Math.min(MAX_DEVICE_QUANTITY, next.availableQuantity ?? MAX_DEVICE_QUANTITY))));
    setError(null);
  };

  const add = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onAdd({ offerKey: offer.key, sku: variant.sku, quantity, mode: choice.mode, termMonths: choice.termMonths });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id={offerAnchorId(offer.key)}
      data-highlighted={highlighted ? 'true' : undefined}
      className={cx('scroll-mt-28 rounded-xl', highlighted && 'outline-4 outline-offset-4 outline-action')}
    >
      <Card as="article" className="flex h-full flex-col">
        <CardHeader tone="brand" className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-3xl font-bold">{offer.name}</h2>
          {headline.fromMonthly ? <div className="font-display text-4xl font-bold">{t('from', { price: formatMoneyExact(headline.fromMonthly, locale) })}</div> : null}
          {headline.outright ? <div className="text-md font-semibold">{t('orOutright', { price: formatMoneyExact(headline.outright, locale) })}</div> : null}
        </CardHeader>
        <CardBody className="flex-1">
          {offer.image ? (
            <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-brand-100">
              <Image src={offer.image} alt="" fill sizes="(min-width: 48rem) 20rem, 100vw" className="object-contain" />
            </div>
          ) : null}
          <DevicePicker colors={offer.colors} memories={offer.memories} color={variant.color} memoryGb={variant.memoryGb} onColor={(next) => pick(next, variant.memoryGb)} onMemory={(next) => pick(variant.color, next)} />
          <AcquisitionModePicker deviceName={offer.name} prices={variant.prices} choice={choice} onChange={(next) => { setChoice(next); setError(null); }} />
          <AcquisitionSummary quote={quote} />
          <div className="flex items-center gap-5">
            <span className="font-display text-sm font-semibold">{t('quantity.label')}</span>
            <QuantityStepper value={quantity} min={1} max={maxQuantity} onChange={setQuantity} decreaseLabel={t('quantity.decrease')} increaseLabel={t('quantity.increase')} valueLabel={t('quantity.label')} />
          </div>
          <Button variant="primary" block disabled={soldOut} loading={busy} onClick={() => void add()}>
            {soldOut ? tb('stock.out') : t('add')}
          </Button>
          {error ? (
            <p role="alert" className="m-0 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
