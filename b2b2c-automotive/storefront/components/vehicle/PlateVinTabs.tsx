// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useContext, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { PILL_PRIMARY } from '@/components/vehicle/styles';
import { VehicleSelectors } from '@/components/vehicle/VehicleSelectors';
import { GarageContext } from '@/context/GarageProvider';
import { useGarage } from '@/hooks/useGarage';
import { useVehicleLookup } from '@/hooks/useVehicleLookup';
import { isAppLocale } from '@/i18n/config';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { buildVehicleId } from '@/lib/vehicles/id';
import { PLATE_COUNTRIES, type LookupResult, type PlateCountry } from '@/lib/vehicles/provider';
import { validatePlate, validateVin } from '@/lib/vehicles/validate';

type Tab = 'vehicle' | 'plate' | 'vin';
const TABS: readonly Tab[] = ['vehicle', 'plate', 'vin'];
const TAB_KEY = { vehicle: 'tabVehicle', plate: 'tabPlate', vin: 'tabVin' } as const;

interface PlateVinTabsProps {
  onAdded?: () => void;
  layout?: 'stack' | 'row';
}

/**
 * How the shopper identifies a vehicle: "Make, model, year" (default), "Plate" or "VIN". The Plate and VIN tabs exist only when the
 * server enabled the lookup (`VEHICLE_LOOKUP_ENABLED`, see `GarageProvider`); otherwise this is just the selectors.
 * Lookup results come from the mock provider and are labelled "Demo lookup"; nothing is saved until the shopper confirms.
 */
export function PlateVinTabs({ onAdded, layout }: PlateVinTabsProps) {
  const { lookupEnabled } = useContext(GarageContext);
  const tf = useTranslations('vehicleFinder');
  const baseId = useId();
  const [tab, setTab] = useState<Tab>('vehicle');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  if (!lookupEnabled) return <VehicleSelectors onAdded={onAdded} layout={layout} />;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!move && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + move + TABS.length) % TABS.length;
    setTab(TABS[next]);
    tabRefs.current[TABS[next]]?.focus();
  }

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label={tf('tabsLabel')} className="flex gap-1 border-b border-border">
        {TABS.map((id, index) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-7 px-3 font-utility text-sm font-medium ${selected ? 'border-b-2 border-border-brand text-text-strong' : 'text-text-muted hover:text-text'}`}
            >
              {tf(TAB_KEY[id])}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel-${tab}`} aria-labelledby={`${baseId}-tab-${tab}`}>
        {tab === 'vehicle' ? (
          <VehicleSelectors onAdded={onAdded} layout={layout} />
        ) : (
          <LookupForm key={tab} kind={tab} onAdded={onAdded} onUseSelectors={() => setTab('vehicle')} />
        )}
      </div>
    </div>
  );
}

type Problem = 'plateFormat' | 'vinLength' | 'vinCharacters' | 'notFoundPlate' | 'notFoundVin' | 'unavailable';

function LookupForm({ kind, onAdded, onUseSelectors }: { kind: 'plate' | 'vin'; onAdded?: () => void; onUseSelectors: () => void }) {
  const tl = useTranslations('vehicleLookup');
  const te = useTranslations('vehicleErrors');
  const locale = useLocale();
  const lookup = useVehicleLookup();
  const { addVehicle } = useGarage();
  const [country, setCountry] = useState<PlateCountry>(isAppLocale(locale) && COUNTRY_CONFIG[locale].country === 'US' ? 'US' : 'DE');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [engine, setEngine] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);

  const reset = () => {
    setResult(null);
    setProblem(null);
    setEngine('');
    setSaveFailed(false);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    reset();
    const checked = kind === 'plate' ? validatePlate(value) : validateVin(value);
    if (!checked.ok) {
      setProblem(({ 'plate-format': 'plateFormat', 'vin-length': 'vinLength', 'vin-characters': 'vinCharacters' } as const)[checked.reason]);
      return;
    }
    setBusy(true);
    const next = await lookup(kind === 'plate' ? { type: 'plate', plate: checked.value, country } : { type: 'vin', vin: checked.value });
    setBusy(false);
    if (next.status === 'invalid') setProblem(({ 'plate-format': 'plateFormat', 'vin-length': 'vinLength', 'vin-characters': 'vinCharacters' } as const)[next.reason]);
    else if (next.status === 'not-found') setProblem(kind === 'plate' ? 'notFoundPlate' : 'notFoundVin');
    else if (next.status === 'unavailable') setProblem('unavailable');
    else setResult(next);
  }

  const vehicleId =
    result?.status === 'resolved'
      ? result.vehicle.id
      : result?.status === 'needs-engine' && engine
        ? buildVehicleId({ make: result.make, model: result.model, year: result.year, engine })
        : null;

  async function save() {
    if (!vehicleId) return;
    setSaveFailed(false);
    try {
      await addVehicle(vehicleId);
      reset();
      setValue('');
      onAdded?.();
    } catch {
      setSaveFailed(true);
    }
  }

  const problemText = problem ? te(problem) : undefined;

  return (
    <div className="grid gap-3">
      <form onSubmit={submit} noValidate className="grid gap-3">
        {kind === 'plate' ? (
          <Select label={tl('plateCountry')} value={country} onChange={(e) => setCountry(e.target.value as PlateCountry)}>
            {PLATE_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {tl(`country${c}`)}
              </option>
            ))}
          </Select>
        ) : null}
        <Field
          label={kind === 'plate' ? tl('plateLabel') : tl('vinLabel')}
          hint={kind === 'plate' ? tl('plateHint') : tl('vinHint')}
          error={problemText}
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={kind === 'plate' ? 12 : 20}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem || result) reset();
          }}
        />
        {problem ? (
          <div>
            <Button variant="link" onClick={onUseSelectors}>
              {te('useSelectors')}
            </Button>
          </div>
        ) : null}
        <button type="submit" disabled={busy || !value.trim()} className={PILL_PRIMARY}>
          {busy ? tl('looking') : kind === 'plate' ? tl('plateLookUp') : tl('vinLookUp')}
        </button>
      </form>

      {result?.status === 'resolved' ? (
        <section aria-label={tl('found')} className="grid gap-2 rounded-md border border-border bg-surface-subtle p-4">
          <p className="font-ui text-sm font-semibold text-text-strong">{result.vehicle.label}</p>
          <p className="font-ui text-xs text-text-muted">{tl('demo')}</p>
          <ResultActions onSave={save} onDiscard={reset} canSave saveFailed={saveFailed} />
        </section>
      ) : null}

      {result?.status === 'needs-engine' ? (
        <section aria-label={tl('found')} className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4">
          <p className="font-ui text-sm text-text-body">{tl('needsEngine', { year: result.year, make: result.make, model: result.model })}</p>
          <p className="font-ui text-xs text-text-muted">{tl('demo')}</p>
          <EngineSelect engines={result.engines} value={engine} onChange={setEngine} />
          <ResultActions onSave={save} onDiscard={reset} canSave={Boolean(vehicleId)} saveFailed={saveFailed} />
        </section>
      ) : null}
    </div>
  );
}

function EngineSelect({ engines, value, onChange }: { engines: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void }) {
  const tf = useTranslations('vehicleFinder');
  return (
    <Select label={tf('fieldEngine')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{tf('chooseEngine')}</option>
      {engines.map((e) => (
        <option key={e.key} value={e.key}>
          {e.label}
        </option>
      ))}
    </Select>
  );
}

function ResultActions({ onSave, onDiscard, canSave, saveFailed }: { onSave: () => void; onDiscard: () => void; canSave: boolean; saveFailed: boolean }) {
  const tl = useTranslations('vehicleLookup');
  const te = useTranslations('vehicleErrors');
  return (
    <div className="grid gap-2">
      {saveFailed ? (
        <p role="alert" className="font-ui text-sm text-danger-600">
          {te('save')}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canSave} onClick={onSave} className={PILL_PRIMARY}>
          {tl('save')}
        </button>
        <Button variant="link" onClick={onDiscard}>
          {tl('notMine')}
        </Button>
      </div>
    </div>
  );
}
