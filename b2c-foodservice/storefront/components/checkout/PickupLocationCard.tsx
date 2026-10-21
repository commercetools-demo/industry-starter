'use client';

import { useTranslations } from 'next-intl';
import { useId, type KeyboardEvent, type Ref } from 'react';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import type { CheckoutPickup } from '@/lib/types';
import FieldError from './FieldError';

export type PickupPersonChoice = 'me' | 'other';

/**
 * The collect cluster's block: the store (address, today's hours, readiness), a Change button, and who is picking up. A pickup
 * name is always asked (Q-K-07): the hosted flow collects the contact later and the store needs the name on the pickup address.
 * The two tiles are one radio group with roving tabindex and arrow keys.
 */
export default function PickupLocationCard({
  pickup, person, name, error, nameRef, onPerson, onName, onBlurName, onChangeStore,
}: {
  pickup: CheckoutPickup;
  person: PickupPersonChoice;
  name: string;
  error?: string;
  nameRef?: Ref<HTMLInputElement>;
  onPerson: (p: PickupPersonChoice) => void;
  onName: (v: string) => void;
  onBlurName: () => void;
  onChangeStore: () => void;
}) {
  const t = useTranslations('checkout.pickup');
  const id = useId();
  const options: { value: PickupPersonChoice; label: string; help: string }[] = [
    { value: 'me', label: t('me'), help: t('meHelp') },
    { value: 'other', label: t('other'), help: t('otherHelp') },
  ];

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const next = options[(index + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length];
    if (!next) return;
    onPerson(next.value);
    (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[options.indexOf(next)])?.focus();
  };

  return (
    <div className="mb-3 rounded-field border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-semibold text-ink">{pickup.storeName}</p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-3">{pickup.address}</p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-3">
            {[pickup.hoursToday ? t('open', { hours: pickup.hoursToday }) : t('closed'), pickup.phone].filter(Boolean).join(' · ')}
          </p>
          {pickup.readyMinutes ? <p className="m-0 mt-1 text-[13px] font-medium text-teal-text">{t('ready', { minutes: pickup.readyMinutes })}</p> : null}
        </div>
        <button
          type="button"
          onClick={onChangeStore}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-ink underline underline-offset-2"
        >
          {t('change')}
        </button>
      </div>

      <p id={`${id}-who`} className="m-0 mb-2 mt-4 text-[13px] font-semibold text-ink-2">
        {t('who')}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-who`} className="grid gap-2.5 mobile:grid-cols-2">
        {options.map((o, i) => {
          const selected = person === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onPerson(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'cursor-pointer rounded-field border bg-surface px-4 py-3 text-left transition-state',
                selected ? 'border-ink ring-1 ring-ink' : 'border-line-2 hover:border-ink',
              )}
            >
              <span className="block text-[14px] font-semibold text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-3">{o.help}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-name`} className="mb-1.5 block text-[12.5px] font-semibold tracking-[0.02em] text-ink-2">
          {t('name')}
        </label>
        <Input
          id={`${id}-name`}
          ref={nameRef}
          value={name}
          autoComplete="name"
          maxLength={80}
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-name-error` : undefined}
          onChange={(e) => onName(e.target.value)}
          onBlur={onBlurName}
        />
        {error ? <FieldError id={`${id}-name-error`}>{error}</FieldError> : null}
      </div>
    </div>
  );
}
