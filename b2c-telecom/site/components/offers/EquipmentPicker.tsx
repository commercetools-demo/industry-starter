'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useReasonText } from '@/components/bundle/useReasonText';
import { CheckIcon } from '@/components/ui/Icon';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import type { CartLine, Locale, Offer } from '@/lib/types';
import { computeEquipmentChoices, type EquipmentChoice, type EquipmentVariantChoice } from './choices';
import { useAttachActions } from './useAttachActions';

type EquipmentPickerProps = {
  plan: Offer;
  planLine: CartLine | undefined;
  /** Lines attached to the plan line (add-ons and equipment). */
  attached: CartLine[];
  equipment: Offer[];
};

/**
 * The equipment of a plan card, grouped by kind. One radio per (equipment, variant): "Rent $8/mo" or "Buy $129.99"; choosing another
 * replaces the one of that kind on the plan in a single write. Equipment that is too slow or the wrong technology is disabled with its
 * reason; equipment the plan includes shows "Included". Undrawn states: Junior design choice (D-068).
 */
export function EquipmentPicker({ plan, planLine, attached, equipment }: EquipmentPickerProps): ReactElement | null {
  const t = useTranslations('offers');
  const locale = useLocale() as Locale;
  const reasonText = useReasonText();
  const { busyKey, errors, attach } = useAttachActions();
  const groups = computeEquipmentChoices(plan, equipment, attached);
  if (groups.length === 0) return null;

  const choose = (choice: EquipmentChoice, variant: EquipmentVariantChoice, previous: EquipmentChoice | undefined): void => {
    if (!planLine || choice.state === 'disabled' || choice.state === 'included') return;
    void attach(choice.offer, variant.sku, 1, planLine.id, previous?.attachedLine?.id);
  };

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const previous = group.choices.find((choice) => choice.attachedLine !== undefined);
        const name = `equipment-${plan.key}-${group.kind}`;
        return (
          <fieldset key={group.kind} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
            <legend className="mb-3 p-0 font-display text-md font-bold">{`${t('equipment')} · ${t(`equipmentKind.${group.kind}`)}`}</legend>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {group.choices.flatMap((choice) => {
                // An included one is one row ("Included"), not one per way of paying for it.
                const showVariants = choice.state === 'included' ? choice.variants.slice(0, 1) : choice.variants;
                return showVariants.map((variant, index) => {
                  const checked = choice.state === 'included' || choice.attachedLine?.sku === variant.sku;
                  const disabled = !planLine || choice.state === 'disabled' || choice.state === 'included' || busyKey !== null;
                  const price = formatMoney(variant.price, locale);
                  return (
                    <li key={`${choice.offer.key}-${variant.sku}`} aria-disabled={choice.state === 'disabled' ? 'true' : undefined} className="flex flex-col gap-1">
                      <label className={cx('flex items-center gap-3 text-md', disabled ? 'cursor-not-allowed text-text-muted' : 'cursor-pointer text-text')}>
                        <input
                          type="radio"
                          name={name}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => choose(choice, variant, previous)}
                          className={cx('size-5 accent-action', FOCUS_RING)}
                        />
                        <span className="flex-1">{choice.offer.name}</span>{' '}
                        {choice.state === 'included' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-text">
                            <CheckIcon />
                            {t('included')}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold">{variant.mode === 'rental' ? t('rent', { price }) : t('buy', { price })}</span>
                        )}
                      </label>
                      {index === 0 && choice.state === 'disabled' && choice.reason ? <p className="m-0 pl-8 text-xs text-text-muted">{reasonText(choice.reason)}</p> : null}
                      {index === 0 && errors[choice.offer.key] ? (
                        <p role="alert" className="m-0 pl-8 text-xs text-danger">
                          {errors[choice.offer.key]}
                        </p>
                      ) : null}
                    </li>
                  );
                });
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
