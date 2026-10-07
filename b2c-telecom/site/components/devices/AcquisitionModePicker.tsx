'use client';

import { useId, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { INSTALLMENT_TERMS } from '@/lib/config/devices';
import { cx } from '@/lib/cx';
import { availableModeNames, getAvailableModes } from '@/lib/devices/acquisition';
import { defaultTermFor, type AcquisitionChoice } from '@/lib/devices/choice';
import type { AcquisitionMode, DevicePrices } from '@/lib/types';
import { ChoiceGroup } from './ChoiceGroup';

type AcquisitionModePickerProps = {
  deviceName: string;
  prices: DevicePrices;
  choice: AcquisitionChoice;
  onChange: (choice: AcquisitionChoice) => void;
};

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];

/**
 * How to pay: three radio cards (pay in full, installments, lease) and, for installments, the term pills. A mode or a term the variant
 * has no price for stays on the screen, disabled, with the reason as text (never hidden): it is not offered for THIS device or variant.
 */
export function AcquisitionModePicker({ deviceName, prices, choice, onChange }: AcquisitionModePickerProps): ReactElement {
  const t = useTranslations('devices');
  const name = useId();
  const noteId = useId();
  const offered = availableModeNames(prices);
  const available = getAvailableModes(prices);
  const missingTerms = INSTALLMENT_TERMS.filter((term) => !available.installments.includes(term));

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label={t('mode.label')} className="flex flex-col gap-3">
        <span className="font-display text-sm font-semibold">{t('mode.label')}</span>
        {MODES.map((mode) => {
          const disabled = !offered.includes(mode);
          return (
            <label key={mode} className={cx('relative flex', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
              <input
                type="radio"
                name={name}
                value={mode}
                checked={choice.mode === mode}
                disabled={disabled}
                onChange={() => onChange({ mode, termMonths: defaultTermFor(prices, mode) })}
                className="peer sr-only"
              />
              <span
                className={cx(
                  'flex w-full flex-col gap-1 rounded-xl border-2 border-border bg-surface px-5 py-3 text-text',
                  'peer-checked:border-action peer-checked:bg-pink-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action',
                  disabled && 'opacity-60',
                )}
              >
                <span className="font-display text-md font-bold">{t(`mode.${mode}`)}</span>
                <span className="text-sm text-text-muted">{disabled ? t('unavailableShort', { device: deviceName }) : t(`mode.description.${mode}`)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {choice.mode === 'installments' ? (
        <>
          <ChoiceGroup
            label={t('term.label')}
            choices={INSTALLMENT_TERMS.map((term) => ({ value: String(term), label: t('term.months', { months: term }), disabled: !available.installments.includes(term) }))}
            value={String(choice.termMonths)}
            onChange={(value) => onChange({ mode: 'installments', termMonths: Number(value) })}
            describedBy={missingTerms.length > 0 ? noteId : undefined}
          />
          {missingTerms.length > 0 ? (
            <p id={noteId} className="m-0 text-sm text-text-muted">
              {missingTerms.map((months) => t('termUnavailable', { months })).join(' ')}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
