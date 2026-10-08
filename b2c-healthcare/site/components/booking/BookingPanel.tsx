'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cx } from '@/components/ui/cx';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { apiDoctorSlots } from '@/lib/api-paths';
import { keyDoctorSlots } from '@/lib/cache-keys';
import { formatIsoDate } from '@/lib/format-date';
import { fetchJson } from '@/lib/http';
import type { ConsultationMode, Money, SlotDay, SlotsResponse } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { BookingModal, type BookingPatient } from './BookingModal';

export interface BookingPanelProps {
  doctor: {
    key: string;
    name: string;
    modes: ConsultationMode[];
    fees: Partial<Record<ConsultationMode, Money>>;
  };
  /** The mode the list sent the visitor with (`?m=`), already limited to what the doctor offers. */
  initialMode: ConsultationMode;
  /** Signed-in patient, resolved on the server; null for a guest. */
  patient: BookingPatient | null;
}

const MODES: ConsultationMode[] = ['remote', 'office'];

function dayParts(date: string, locale: string): { weekday: string; day: number } {
  const at = new Date(`${date}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(at),
    day: at.getUTCDate(),
  };
}

function zoneName(timezone: string, date: string | undefined, locale: string): string {
  try {
    const at = new Date(`${date ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: 'long' }).formatToParts(at);
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/**
 * Sticky booking panel (client; data is read live from `/api/doctors/:key/slots`, never cached): mode toggle with the
 * fee of the chosen mode, a 7-day picker, a 3-column time grid, then the confirm dialog. A mode the doctor does not
 * offer is disabled; a mode without a resolvable fee shows "Fee unavailable" and offers no times.
 */
export function BookingPanel({ doctor, initialMode, patient }: BookingPanelProps) {
  const t = useTranslations('booking.panel');
  const locale = useLocale();
  const [mode, setMode] = useState<ConsultationMode>(initialMode);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ startsAt: string; time: string; date: string } | null>(null);

  const fee = doctor.fees[mode];
  const { data, error, isLoading, mutate } = useSWR<SlotsResponse>(
    fee ? keyDoctorSlots(doctor.key, mode) : null,
    () => fetchJson<SlotsResponse>(apiDoctorSlots(doctor.key, mode)),
    { revalidateOnFocus: true, revalidateIfStale: true, dedupingInterval: 0, shouldRetryOnError: false },
  );

  const days: SlotDay[] = data?.days ?? [];
  const day: SlotDay | undefined = days.find((d) => d.date === selectedDate) ?? days.find((d) => d.slots.length > 0) ?? days[0];
  const feeText = fee ? formatMoney(fee.centAmount, fee.currencyCode, locale) : null;

  return (
    <Card as="aside" className="grid gap-4 nav:sticky nav:top-24" aria-labelledby="booking-title" data-testid="booking-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 id="booking-title" className="font-display text-xl font-semibold text-text-heading">
          {t('title')}
        </h2>
        <b data-testid="booking-fee" className="font-display text-xl text-navy-700">
          {feeText ?? t('feeUnavailable')}
        </b>
      </div>

      <SegmentedControl
        label={t('mode')}
        className="w-full [&>*]:flex-1"
        value={mode}
        onChange={(value) => {
          setMode(value as ConsultationMode);
          setPicked(null);
        }}
        items={MODES.map((m) => ({ value: m, label: t(m), disabled: !doctor.modes.includes(m) }))}
      />

      {!fee ? (
        <p role="status" className="rounded-md bg-neutral-50 p-3.5 text-sm text-neutral-600">
          {t('feeUnavailableNote')}
        </p>
      ) : error ? (
        <div role="alert" className="grid justify-items-start gap-2 text-sm text-neutral-600">
          <p>{t('loadError')}</p>
          <Button size="sm" variant="outline" onClick={() => void mutate()}>
            {t('retry')}
          </Button>
        </div>
      ) : isLoading || !data ? (
        <p role="status" className="text-sm text-neutral-600">
          {t('loading')}
        </p>
      ) : (
        <>
          <div role="group" aria-label={t('days')} className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const parts = dayParts(d.date, locale);
              const selected = d.date === day?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={selected}
                  data-date={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={cx(
                    'grid cursor-pointer justify-items-center gap-0.5 rounded-md border border-border px-1 py-2 font-meta text-xs',
                    selected ? 'border-navy-700 bg-navy-700 text-text-on-brand' : 'bg-surface text-navy-900 hover:bg-brand-50',
                  )}
                >
                  {parts.weekday}
                  <b className="font-display text-md">{parts.day}</b>
                </button>
              );
            })}
          </div>
          {day ? <p className="text-sm text-neutral-600">{formatIsoDate(day.date, locale)}</p> : null}
          {day && day.slots.length > 0 ? (
            <div role="group" aria-label={t('times')} className="grid grid-cols-3 gap-2">
              {day.slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  data-slot={slot.startsAt}
                  onClick={() => setPicked({ startsAt: slot.startsAt, time: slot.time, date: day.date })}
                  className="cursor-pointer rounded-sm border border-brand-300 bg-surface px-2 py-2 font-display text-sm font-medium text-navy-900 hover:bg-action hover:text-action-label"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-brand-50 p-3.5 text-sm text-navy-900">{t('noTimes')}</p>
          )}
          <p className="text-xs text-neutral-600">{t('zone', { zone: zoneName(data.timezone, day?.date, locale) })}</p>
        </>
      )}

      <p className="font-meta text-sm text-neutral-600">{patient ? t('asPatient', { name: patient.name }) : t('asGuest')}</p>

      {picked ? (
        <BookingModal
          open
          onClose={() => setPicked(null)}
          doctor={{ key: doctor.key, name: doctor.name }}
          mode={mode}
          dateText={formatIsoDate(picked.date, locale)}
          time={picked.time}
          startsAt={picked.startsAt}
          feeText={feeText}
          patient={patient}
          onTaken={() => void mutate()}
        />
      ) : null}
    </Card>
  );
}
