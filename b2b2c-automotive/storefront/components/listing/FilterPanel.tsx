// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FitToggle } from '@/components/vehicle/FitToggle';
import { usePathname, useRouter } from '@/i18n/routing';
import type { FacetGroup } from '@/lib/types';

export interface FilterPanelProps {
  groups: FacetGroup[];
  /** City of the selected branch for "Pickup today at {city}". */
  city?: string;
  /** False for a store without branches: the pickup filter is disabled with a hint. */
  pickupAvailable: boolean;
}

type Values = Record<string, string[]>;
const CHECKBOX = 'size-5 shrink-0 accent-action';
const ROW = 'flex min-h-7 cursor-pointer items-center gap-3 font-ui text-sm text-text';

const selectedValues = (groups: FacetGroup[]): Values => Object.fromEntries(groups.map((g) => [g.param, g.options.filter((o) => o.selected).map((o) => o.key)]));
const alphabetical = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** Writes `values` and `pickup` into a copy of `search`; every other parameter stays, the page is dropped (the result set changes). */
function withFilters(search: URLSearchParams, managed: string[], values: Values, pickup: boolean): URLSearchParams {
  const next = new URLSearchParams(search.toString());
  for (const param of managed) next.delete(param);
  for (const param of managed) for (const v of [...(values[param] ?? [])].sort()) next.append(param, v);
  if (pickup) next.set('pickup', '1');
  else next.delete('pickup');
  next.delete('page');
  return next;
}

interface FormProps extends FilterPanelProps {
  values: Values;
  pickup: boolean;
  onToggle: (param: string, value: string) => void;
  onTogglePickup: () => void;
}

/** The form body shared by the side panel (changes apply at once) and the mobile sheet (changes apply with "Apply"). */
function FilterForm({ groups, city, pickupAvailable, values, pickup, onToggle, onTogglePickup }: FormProps) {
  const t = useTranslations('filters');
  const pickupId = useId();
  const hintId = useId();
  return (
    <div className="grid gap-4">
      <FitToggle />
      <div className="grid gap-1">
        <label htmlFor={pickupId} className={`${ROW} ${pickupAvailable ? '' : 'cursor-not-allowed opacity-60'}`}>
          <input id={pickupId} type="checkbox" className={CHECKBOX} checked={pickup && pickupAvailable} disabled={!pickupAvailable} aria-describedby={pickupAvailable ? undefined : hintId} onChange={onTogglePickup} />
          {t('pickup', { city: city ?? '' }).trim()}
        </label>
        {pickupAvailable ? null : (
          <p id={hintId} className="font-ui text-xs text-text-subtle">
            {t('pickupUnavailable')}
          </p>
        )}
      </div>
      {groups.map((group) => (
        <fieldset key={group.param} className="m-0 grid gap-2 border-0 border-t border-border p-0 pt-4">
          <legend className="float-left mb-2 w-full font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{group.title}</legend>
          {[...group.options].sort(alphabetical).map((option) => (
            <label key={option.key} className={ROW}>
              <input type="checkbox" className={CHECKBOX} checked={(values[group.param] ?? []).includes(option.key)} onChange={() => onToggle(group.param, option.key)} />
              {t('option', { label: option.label, count: option.count })}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/** Side panel from 700 px: every change goes to the address at once (`router.replace`, page removed). */
export function FilterPanel(props: FilterPanelProps) {
  const t = useTranslations('filters');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const managed = props.groups.map((g) => g.param);
  const values = selectedValues(props.groups);
  const pickup = search.get('pickup') === '1';

  function go(nextValues: Values, nextPickup: boolean) {
    const qs = withFilters(search, managed, nextValues, nextPickup).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const toggle = (param: string, value: string) => {
    const current = values[param] ?? [];
    go({ ...values, [param]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] }, pickup);
  };

  return (
    <aside aria-labelledby="filter-panel-title" className="hidden content-start gap-4 rounded-md border border-border bg-surface p-4 min-[43.75rem]:grid">
      <h2 id="filter-panel-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <FilterForm {...props} values={values} pickup={pickup} onToggle={toggle} onTogglePickup={() => go(values, !pickup)} />
    </aside>
  );
}

/** Under 700 px: a "Filters" button opens a sheet with the same form; "Apply" writes the choices, closing keeps the address. */
export function FilterSheet(props: FilterPanelProps) {
  const t = useTranslations('filters');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Values>({});
  const [draftPickup, setDraftPickup] = useState(false);
  const managed = props.groups.map((g) => g.param);
  const activeCount = props.groups.reduce((n, g) => n + g.options.filter((o) => o.selected).length, 0) + (search.get('pickup') === '1' ? 1 : 0);

  function openSheet() {
    setDraft(selectedValues(props.groups));
    setDraftPickup(search.get('pickup') === '1');
    setOpen(true);
  }
  function apply() {
    const qs = withFilters(search, managed, draft, draftPickup).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  }
  const toggle = (param: string, value: string) =>
    setDraft((d) => {
      const current = d[param] ?? [];
      return { ...d, [param]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
    });

  return (
    <div className="min-[43.75rem]:hidden">
      <Button variant="secondary" aria-haspopup="dialog" aria-label={activeCount > 0 ? t('openWithCount', { count: activeCount }) : undefined} onClick={openSheet}>
        {t('open')}
        {activeCount > 0 ? <span className="rounded-xs bg-action px-2 font-ui text-xs text-text-on-brand">{activeCount}</span> : null}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} className="max-h-[85vh]">
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <h2 id={titleId} className="m-0 font-display text-lg font-semibold text-text">
              {t('title')}
            </h2>
            <Button variant="link" onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <FilterForm {...props} values={draft} pickup={draftPickup} onToggle={toggle} onTogglePickup={() => setDraftPickup((p) => !p)} />
          </div>
          <div className="border-t border-border p-4">
            <Button className="w-full" onClick={apply}>
              {t('apply')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
