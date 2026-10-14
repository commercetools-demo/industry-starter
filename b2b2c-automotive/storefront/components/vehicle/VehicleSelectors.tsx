// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useReducer, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PILL_PRIMARY } from '@/components/vehicle/styles';
import { useGarage } from '@/hooks/useGarage';
import { useVehicleOptions } from '@/hooks/useVehicleOptions';
import { initialSelection, LEVELS, optionsQuery, selectorReducer, type Level } from '@/lib/vehicles/selectorReducer';

interface VehicleSelectorsProps {
  /** Called after the vehicle was saved and activated. */
  onAdded?: () => void;
  /** `stack` (default): one column, two from 640 px. `row`: four columns from 1024 px (listing bar). */
  layout?: 'stack' | 'row';
}

const LABEL_KEY = { make: 'fieldMake', model: 'fieldModel', year: 'fieldYear', engine: 'fieldEngine' } as const;
const CHOOSE_KEY = { make: 'chooseMake', model: 'chooseModel', year: 'chooseYear', engine: 'chooseEngine' } as const;

/**
 * Four dependent selects (Make, Model, Year, Engine) and the "Verify fitment" button. Each select is disabled until the one before it
 * is chosen; choosing a level clears every lower one. Options come from `/api/vehicles/options` (derived from the year ranges of the
 * vehicle table). "Verify fitment" saves the vehicle to the garage and makes it active.
 */
export function VehicleSelectors({ onAdded, layout = 'stack' }: VehicleSelectorsProps) {
  const t = useTranslations('vehicleFinder');
  const te = useTranslations('vehicleErrors');
  const errorId = useId();
  const { addVehicle } = useGarage();
  const [selection, dispatch] = useReducer(selectorReducer, initialSelection);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const make = useVehicleOptions(optionsQuery(selection, 'make'));
  const model = useVehicleOptions(optionsQuery(selection, 'model'));
  const year = useVehicleOptions(optionsQuery(selection, 'year'));
  const engine = useVehicleOptions(optionsQuery(selection, 'engine'));
  const levels = { make, model, year, engine } as const;
  const failed = LEVELS.some((level) => levels[level].error);

  const vehicleId = engine.options.find((o) => o.key === selection.engine)?.vehicleId;

  async function verify() {
    if (!vehicleId) return;
    setSaving(true);
    setSaveError(false);
    try {
      await addVehicle(vehicleId);
      dispatch({ type: 'reset' });
      onAdded?.();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const columns = layout === 'row' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className="grid gap-3">
      <div className={`grid gap-3 ${columns}`}>
        {LEVELS.map((level: Level) => {
          const { options, isLoading } = levels[level];
          const available = optionsQuery(selection, level) !== null;
          return (
            <Select
              key={level}
              label={t(LABEL_KEY[level])}
              value={selection[level] ?? ''}
              disabled={!available || isLoading}
              aria-busy={isLoading || undefined}
              onChange={(event) => dispatch({ type: 'select', level, key: event.target.value })}
            >
              <option value="">{t(CHOOSE_KEY[level])}</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          );
        })}
      </div>
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 font-ui text-sm text-danger-600">
          <span>{te('options')}</span>
          <Button variant="link" onClick={() => LEVELS.forEach((level) => levels[level].retry())}>
            {te('retry')}
          </Button>
        </div>
      ) : null}
      {saveError ? (
        <p id={errorId} role="alert" className="font-ui text-sm text-danger-600">
          {te('save')}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!vehicleId || saving}
        onClick={verify}
        aria-describedby={saveError ? errorId : undefined}
        className={PILL_PRIMARY}
      >
        {saving ? t('saving') : t('verify')}
      </button>
    </div>
  );
}
