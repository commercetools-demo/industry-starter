'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/Inputs';
import { CONTROL_CLASSES } from '@/components/ui/Field';
import { usePathname, useRouter } from '@/i18n/routing';
import { listingHref, type ListingState } from '@/lib/listing-url';
import { CITIES, SPECIALTIES } from '@/lib/specialties';
import type { ConsultationMode } from '@/lib/types';

const DEBOUNCE_MS = 350;

export interface DoctorFiltersProps {
  mode: ConsultationMode;
  /** Filter state parsed from the URL by the page (the URL is the source of truth). */
  state: ListingState;
}

/**
 * Filter bar: search by name or specialty, specialty, city (office only) and "Available today". Every change
 * replaces the URL (page back to 1); the server renders the new list. Text is applied after a short pause or
 * on Enter, so typing does not request a page per keystroke.
 */
export function DoctorFilters({ mode, state }: DoctorFiltersProps) {
  const t = useTranslations('doctors.filters');
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(state.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Back/forward or "clear filters" change the URL: follow it (state derived from props, no effect).
  const [seenQuery, setSeenQuery] = useState(state.q);
  if (seenQuery !== state.q) {
    setSeenQuery(state.q);
    setText(state.q);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (patch: Partial<ListingState>) => {
    clearTimeout(timer.current);
    router.replace(listingHref(pathname, { ...state, ...patch, page: 1 }), { scroll: false });
  };

  return (
    <form
      role="search"
      aria-label={t('label')}
      onSubmit={(event) => {
        event.preventDefault();
        if (text !== state.q) apply({ q: text });
      }}
      className="relative -mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-surface p-3.5 shadow-sm"
    >
      <input
        type="search"
        name="q"
        aria-label={t('search')}
        placeholder={t('searchPlaceholder')}
        value={text}
        maxLength={80}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => apply({ q: value }), DEBOUNCE_MS);
        }}
        className={`${CONTROL_CLASSES} h-11.5 flex-[3_1_16rem]`}
      />
      <select
        name="specialty"
        aria-label={t('specialty')}
        value={state.specialty}
        onChange={(event) => apply({ specialty: event.target.value })}
        className={`${CONTROL_CLASSES} h-11.5 flex-[1_1_10rem]`}
      >
        <option value="">{t('allSpecialties')}</option>
        {SPECIALTIES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      {mode === 'office' ? (
        <select
          name="city"
          aria-label={t('city')}
          value={state.city}
          onChange={(event) => apply({ city: event.target.value })}
          className={`${CONTROL_CLASSES} h-11.5 flex-[1_1_10rem]`}
        >
          <option value="">{t('allCities')}</option>
          {CITIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}
      <Checkbox label={t('today')} name="today" checked={state.today} onChange={(event) => apply({ today: event.target.checked })} />
    </form>
  );
}
