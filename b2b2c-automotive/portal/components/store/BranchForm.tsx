'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Add or edit a branch (workstream U-05): name per language, address, position (map click or drag, or the two always-visible
// coordinate fields), pickup promise, phone, time zone and opening hours. Opens in a drawer.
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ChangeEvent } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { buttonPrimary, buttonSecondary, errorNote, hintClass, inputClass, labelClass, selectClass } from '@/components/portal/kit';
import { failureText } from '@/hooks/sellerHttp';
import { useStoreActions } from '@/hooks/storeApi';
import { branchInput, createBranchInput, LANGUAGES, PICKUP_MODES, slugOf, WEEKDAYS, type BranchInput, type OpeningHours, type PickupMode, type Weekday } from '@/lib/store/schemas';
import type { Branch } from '@/lib/store/types';
import { LazyBranchMap } from './LazyBranchMap';
import type { MapPoint } from './BranchMap';

interface DayState {
  open: boolean;
  from: string;
  to: string;
}

const DEFAULT_DAY: DayState = { open: true, from: '08:00', to: '18:00' };

function daysFrom(hours: OpeningHours | undefined): Record<Weekday, DayState> {
  return Object.fromEntries(
    WEEKDAYS.map((day) => {
      const pair = hours?.[day];
      return [day, pair ? { open: true, from: pair[0], to: pair[1] } : { ...DEFAULT_DAY, open: hours === undefined ? day !== 'sat' && day !== 'sun' : false }];
    }),
  ) as Record<Weekday, DayState>;
}

export function BranchForm({ branch, others, storeTimezone, onClose }: { branch: Branch | null; others: MapPoint[]; storeTimezone: string; onClose: () => void }) {
  const t = useTranslations('store.branches.form');
  const tDays = useTranslations('store.branches.days');
  const tPickup = useTranslations('store.branches.pickup');
  const { createBranch, updateBranch, geocode } = useStoreActions();
  const editing = branch !== null;

  const [names, setNames] = useState<Record<string, string>>(() => ({ ...(branch?.name ?? { 'de-DE': '', 'en-US': '' }) }));
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState({ streetName: branch?.address.streetName ?? '', streetNumber: branch?.address.streetNumber ?? '', postalCode: branch?.address.postalCode ?? '', city: branch?.address.city ?? '', country: branch?.address.country ?? 'DE' });
  const [lat, setLat] = useState(branch?.geoLocation ? String(branch.geoLocation.lat) : '');
  const [lng, setLng] = useState(branch?.geoLocation ? String(branch.geoLocation.lng) : '');
  const [phone, setPhone] = useState(branch?.phone ?? '');
  const [timezone, setTimezone] = useState(branch?.timezone ?? storeTimezone);
  const [pickupMode, setPickupMode] = useState<PickupMode>(branch?.pickupMode ?? 'same-day');
  const [days, setDays] = useState(() => daysFrom(branch?.openingHours));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const point = useMemo(() => {
    const a = lat.trim() === '' ? NaN : Number(lat);
    const b = lng.trim() === '' ? NaN : Number(lng);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
  }, [lat, lng]);

  const effectiveSlug = slugTouched ? slug : slugOf(names['en-US'] ?? '');

  function build(): Omit<BranchInput, 'storeKey'> | { problem: string } {
    const openingHours: OpeningHours = {};
    for (const day of WEEKDAYS) if (days[day].open) openingHours[day] = [days[day].from, days[day].to];
    const trimmedPhone = phone.trim();
    const candidate = {
      storeKey: 'placeholder',
      name: names,
      address: { ...address, streetNumber: address.streetNumber.trim() === '' ? undefined : address.streetNumber.trim(), country: address.country.trim().toUpperCase() },
      geoLocation: point ?? undefined,
      openingHours,
      timezone: timezone.trim(),
      pickupMode,
      phone: trimmedPhone === '' ? undefined : trimmedPhone,
    };
    const parsed = branchInput.safeParse(candidate);
    if (!parsed.success) return { problem: parsed.error.issues[0].message };
    const { storeKey: _unused, ...rest } = parsed.data;
    void _unused;
    return rest;
  }

  async function onSave() {
    setError('');
    if ((lat.trim() === '') !== (lng.trim() === '') || (lat.trim() !== '' && point === null)) return setError(t('coordinates'));
    const built = build();
    if ('problem' in built) return setError(built.problem);
    setBusy(true);
    let failure = '';
    if (editing) {
      const result = await updateBranch(branch.key, built);
      if (!result.ok) failure = failureText(result, t('saveFailed'));
    } else {
      const withSlug = createBranchInput.safeParse({ ...built, storeKey: 'placeholder', slug: effectiveSlug });
      if (!withSlug.success) {
        setBusy(false);
        return setError(withSlug.error.issues[0].message);
      }
      const result = await createBranch({ ...built, slug: effectiveSlug });
      if (!result.ok) failure = failureText(result, t('saveFailed'));
    }
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  }

  async function onFind() {
    setNote('');
    const query = [address.streetName, address.streetNumber, address.postalCode, address.city, address.country].map((s) => s.trim()).filter(Boolean).join(', ');
    const result = await geocode(query);
    if (!result.ok) return setError(failureText(result, t('geocodeFailed')));
    const hit = result.data?.result;
    if (!hit) return setNote(t(result.data?.unavailable ? 'geocodeUnavailable' : 'geocodeNone'));
    setLat(String(hit.lat));
    setLng(String(hit.lng));
    setCenter({ lat: hit.lat, lng: hit.lng });
  }

  const text = (label: string, value: string, set: (v: string) => void, props: { maxLength?: number; inputMode?: 'decimal' } = {}) => (
    <label className="flex flex-col gap-100">
      <span className={labelClass}>{label}</span>
      <input value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => set(e.target.value)} className={inputClass} {...props} />
    </label>
  );
  const setDay = (day: Weekday, change: Partial<DayState>) => setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...change } }));

  return (
    <Dialog
      open
      variant="drawer"
      title={editing ? t('editTitle', { name: branch.name['de-DE'] ?? branch.key }) : t('addTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonSecondary}>
            {t('cancel')}
          </button>
          <button type="button" onClick={onSave} disabled={busy} className={buttonPrimary}>
            {busy ? t('saving') : t('save')}
          </button>
        </>
      }
    >
      <div className="grid gap-300 sm:grid-cols-2">
        {LANGUAGES.map((language) => (
          <div key={language}>{text(t('name', { language }), names[language] ?? '', (v) => setNames((prev) => ({ ...prev, [language]: v })), { maxLength: 80 })}</div>
        ))}
      </div>
      {editing ? null : (
        <div className="flex flex-col gap-100">
          {text(t('shortName'), effectiveSlug, (v) => {
            setSlug(v);
            setSlugTouched(true);
          }, { maxLength: 40 })}
          <span className={hintClass}>{t('shortNameHint')}</span>
        </div>
      )}
      <div className="grid gap-300 sm:grid-cols-3">
        <div className="sm:col-span-2">{text(t('street'), address.streetName, (v) => setAddress((p) => ({ ...p, streetName: v })), { maxLength: 80 })}</div>
        {text(t('number'), address.streetNumber, (v) => setAddress((p) => ({ ...p, streetNumber: v })), { maxLength: 10 })}
        {text(t('postalCode'), address.postalCode, (v) => setAddress((p) => ({ ...p, postalCode: v })), { maxLength: 12 })}
        {text(t('city'), address.city, (v) => setAddress((p) => ({ ...p, city: v })), { maxLength: 60 })}
        {text(t('country'), address.country, (v) => setAddress((p) => ({ ...p, country: v })), { maxLength: 2 })}
      </div>
      <div className="grid gap-300 sm:grid-cols-2">
        {text(t('latitude'), lat, setLat, { inputMode: 'decimal' })}
        {text(t('longitude'), lng, setLng, { inputMode: 'decimal' })}
      </div>
      <div>
        <button type="button" onClick={onFind} className={buttonSecondary}>
          {t('findCoordinates')}
        </button>
      </div>
      {note ? <p role="status" className={hintClass}>{note}</p> : null}
      <div className="h-6400">
        <LazyBranchMap points={others} value={point} center={center} label={t('mapLabel')} pinName={t('pinName')} onPick={(a, b) => { setLat(a.toFixed(6)); setLng(b.toFixed(6)); }} />
      </div>
      <p className={hintClass}>{t('mapHint')}</p>
      <div className="grid gap-300 sm:grid-cols-2">
        <label className="flex flex-col gap-100">
          <span className={labelClass}>{t('pickupMode')}</span>
          <select value={pickupMode} onChange={(e) => setPickupMode(e.target.value as PickupMode)} className={selectClass}>
            {PICKUP_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {tPickup(mode)}
              </option>
            ))}
          </select>
        </label>
        {text(t('phone'), phone, setPhone, { maxLength: 30 })}
      </div>
      {text(t('timezone'), timezone, setTimezone, { maxLength: 60 })}
      <fieldset className="flex flex-col gap-200">
        <legend className={labelClass}>{t('hours')}</legend>
        {WEEKDAYS.map((day) => (
          <div key={day} className="grid grid-cols-[1fr_auto_auto] items-center gap-300 sm:grid-cols-[calc(var(--space-6400)/2)_auto_auto_auto]">
            <label className="flex items-center gap-200 text-body-2 font-semibold text-text">
              <input type="checkbox" checked={days[day].open} onChange={(e) => setDay(day, { open: e.target.checked })} />
              {tDays(day)}
            </label>
            {days[day].open ? (
              <>
                <input type="time" aria-label={t('opens', { day: tDays(day) })} value={days[day].from} onChange={(e) => setDay(day, { from: e.target.value })} className={inputClass} />
                <input type="time" aria-label={t('closes', { day: tDays(day) })} value={days[day].to} onChange={(e) => setDay(day, { to: e.target.value })} className={inputClass} />
              </>
            ) : (
              <span className={`${hintClass} col-span-2`}>{t('closed')}</span>
            )}
          </div>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className={errorNote}>
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
