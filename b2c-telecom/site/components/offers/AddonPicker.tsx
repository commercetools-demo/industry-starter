'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useReasonText } from '@/components/bundle/useReasonText';
import { CheckIcon } from '@/components/ui/Icon';
import { ProductImage } from '@/components/ui/ProductImage';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/format';
import { addonPrice } from '@/lib/listing/cardData';
import type { CartLine, Locale, Offer } from '@/lib/types';
import { computeAddonChoices, type AddonChoice } from './choices';
import { useAttachActions } from './useAttachActions';

type AddonPickerProps = {
  plan: Offer;
  /** The plan's line in the bundle; without it the rows are shown but cannot be changed. */
  planLine: CartLine | undefined;
  /** Lines attached to the plan line (add-ons and equipment). */
  attached: CartLine[];
  addons: Offer[];
  /** Path (no locale) of the add-ons listing: "the same add-ons remain separately browsable". */
  browseHref: string | null;
};

/**
 * The add-ons of a plan card (undrawn states: Junior design choice, D-068). Rows are checkboxes; one that does not fit the plan is
 * disabled with the reason in muted text, one the plan includes shows "Included" checked, one for another kind of plan is not listed.
 */
export function AddonPicker({ plan, planLine, attached, addons, browseHref }: AddonPickerProps): ReactElement | null {
  const t = useTranslations('offers');
  const locale = useLocale() as Locale;
  const reasonText = useReasonText();
  const { busyKey, errors, attach, detach } = useAttachActions();
  const choices = computeAddonChoices(plan, addons, attached);

  const toggle = (choice: AddonChoice): void => {
    if (!planLine) return;
    if (choice.state === 'attached' && choice.attachedLine) void detach(choice.offer, choice.attachedLine);
    else if (choice.state === 'selectable') {
      const master = choice.offer.variants.find((variant) => variant.isMaster) ?? choice.offer.variants[0];
      if (master) void attach(choice.offer, master.sku, planLine.quantity, planLine.id);
    }
  };

  if (choices.length === 0 && !browseHref) return null;
  return (
    <fieldset className="@container m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-3 p-0 font-display text-md font-bold">{t('addons')}</legend>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 @xl:grid-cols-4">
        {choices.map((choice) => {
          const price = addonPrice(choice.offer);
          const checked = choice.state === 'attached' || choice.state === 'included';
          const disabled = !planLine || choice.state === 'included' || choice.state === 'disabled' || busyKey !== null;
          const muted = choice.state === 'disabled' || !planLine;
          return (
            <li key={choice.offer.key} aria-disabled={choice.state === 'disabled' ? 'true' : undefined} className={cx('flex flex-col overflow-hidden rounded-lg border bg-surface', checked ? 'border-action' : 'border-border')}>
              <label className={cx('flex h-full flex-col text-md', muted ? 'text-text-muted' : 'text-text', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                <ProductImage src={choice.offer.image} name={choice.offer.name} sizes="(min-width: 40rem) 12rem, 50vw" className={muted ? 'opacity-60' : undefined} />
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(choice)}
                      className={cx('mt-0.5 size-5 shrink-0 accent-action', FOCUS_RING)}
                    />
                    <span className="flex-1 text-sm font-semibold leading-snug">{choice.offer.name}</span>
                  </span>
                  {choice.state === 'included' ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-text">
                      <CheckIcon />
                      {t('included')}
                    </span>
                  ) : price ? (
                    <span className="text-sm font-semibold">
                      {formatMoney(price.amount, locale)}
                      {price.recurring ? t('perMonth') : ''}
                    </span>
                  ) : null}
                </span>
              </label>
              {choice.state === 'disabled' && choice.reason ? <p className="m-0 px-3 pb-3 text-xs text-text-muted">{reasonText(choice.reason)}</p> : null}
              {errors[choice.offer.key] ? (
                <p role="alert" className="m-0 px-3 pb-3 text-xs text-danger">
                  {errors[choice.offer.key]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {browseHref ? (
        <Link href={browseHref} className={cx('self-start font-display text-sm font-semibold text-text-link underline underline-offset-4', FOCUS_RING)}>
          {t('browseAll')}
        </Link>
      ) : null}
    </fieldset>
  );
}
