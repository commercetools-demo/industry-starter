// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useGarage } from '@/hooks/useGarage';
import { groupRangesForDisplay, vehicleInRange } from '@/lib/vehicles/fitment-keys';

/** More rows than this: the first `PREVIEW_ROWS` with a filter box and "Show all". */
export const LONG_LIST = 20;
export const PREVIEW_ROWS = 10;

/**
 * Compatible vehicles grouped by make, model and years ("Volkswagen Golf · 2012–2019 · 1.4 TSI, 2.0 TDI"), newest first within a
 * model. The row of the active vehicle (its year inside the range) is tinted and says "Your vehicle". A `universal-fit` part says
 * "Fits all vehicles" instead of a list.
 */
export function CompatibleVehicles({ fitmentKeys, universalFit }: { fitmentKeys: string[]; universalFit: boolean }) {
  const t = useTranslations('pdp');
  const { active } = useGarage();
  const filterId = useId();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(
    () =>
      groupRangesForDisplay(fitmentKeys)
        .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || b.yearFrom - a.yearFrom)
        .map((range) => ({
          id: `${range.make}|${range.model}|${range.yearFrom}|${range.yearTo}`,
          label: t('vehicleRow', { make: range.make, model: range.model, from: range.yearFrom, to: range.yearTo, engines: range.engines.join(', ') }),
          mine: active !== null && range.engines.some((engine) => vehicleInRange(active, { make: range.make, model: range.model, yearFrom: range.yearFrom, yearTo: range.yearTo, engine })),
        })),
    [fitmentKeys, active, t],
  );

  const long = rows.length > LONG_LIST;
  const needle = query.trim().toLowerCase();
  const matches = needle ? rows.filter((row) => row.label.toLowerCase().includes(needle)) : rows;
  const visible = long && !showAll && !needle ? matches.slice(0, PREVIEW_ROWS) : matches;

  return (
    <div>
      <h2 className="m-0 mb-3 font-display text-lg font-semibold text-text">{t('compatible')}</h2>
      {universalFit ? (
        <p className="m-0 font-ui text-sm text-text-body">{t('fitsAll')}</p>
      ) : rows.length === 0 ? (
        <p className="m-0 font-ui text-sm text-text-muted">{t('noVehicles')}</p>
      ) : (
        <div className="grid gap-3">
          {long ? <Field id={filterId} label={t('filterVehicles')} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
          <ul className="m-0 list-none p-0 font-ui text-sm">
            {visible.map((row) => (
              <li key={row.id} className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-3 ${row.mine ? 'bg-success-50 text-success-600' : 'text-text'}`}>
                <span>{row.label}</span>
                {row.mine ? <span className="font-bold">{t('yourVehicle')}</span> : null}
              </li>
            ))}
          </ul>
          {long && !showAll && !needle ? (
            <Button variant="secondary" onClick={() => setShowAll(true)}>
              {t('showAll', { count: rows.length })}
            </Button>
          ) : null}
          {needle && matches.length === 0 ? <p className="m-0 font-ui text-sm text-text-muted">{t('noMatches')}</p> : null}
        </div>
      )}
    </div>
  );
}
