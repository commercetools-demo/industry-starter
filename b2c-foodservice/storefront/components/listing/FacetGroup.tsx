'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { swatchColour } from '@/lib/product/swatches';
import type { FacetGroup as FacetGroupModel, FacetOption } from '@/lib/types';

const VISIBLE = 6;

/**
 * One collapsible filter group. Link mode (sidebar): every option is an `a` with the new URL, so it works without
 * JavaScript and the back button restores state. Draft mode (mobile sheet): options are buttons that call `onToggle`.
 * An option with count 0 that is not selected is a disabled button ("Dead end avoided").
 */
export default function FacetGroup({
  group, onToggle,
}: {
  group: FacetGroupModel;
  onToggle?: (facet: string, value: string) => void;
}) {
  const t = useTranslations('plp.filters');
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const bodyId = useId();
  const long = group.options.length > VISIBLE && group.control !== 'grid';
  const role = group.control === 'radio' ? 'radio' : 'checkbox';

  return (
    <fieldset className="m-0 border-0 border-b border-line p-0 py-4">
      <legend className="sr-only">{group.label}</legend>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <span className="font-display text-[14.5px] font-semibold text-ink">{group.label}</span>
        <span className="flex items-center gap-2">
          {group.selectedCount > 0 ? (
            <span className="rounded-pill bg-accent px-2 py-0.5 font-mono text-[11px] text-surface">{group.selectedCount}</span>
          ) : null}
          <Icon name={open ? 'minus' : 'plus'} size={16} className="text-ink-2" />
        </span>
      </button>
      <div id={bodyId} hidden={!open} className={cn('mt-3', group.control === 'grid' ? 'grid grid-cols-4 gap-2' : 'flex flex-col gap-0.5')}>
        {group.options.map((o, i) => (
          <Option
            key={o.value}
            facet={group}
            option={o}
            role={role}
            hidden={long && !showAll && i >= VISIBLE && !o.selected}
            onToggle={onToggle}
          />
        ))}
        {long ? (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="mt-1 self-start border-0 bg-transparent p-0 text-[13px] font-medium text-accent underline underline-offset-2"
          >
            {showAll ? t('showLess') : t('showAll', { n: group.options.length })}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

function Option({
  facet, option, role, hidden, onToggle,
}: {
  facet: FacetGroupModel;
  option: FacetOption;
  role: 'radio' | 'checkbox';
  hidden: boolean;
  onToggle?: (facet: string, value: string) => void;
}) {
  const grid = facet.control === 'grid';
  const dead = option.count === 0 && !option.selected;
  const row = cn(
    'transition-state flex items-center gap-2.5 text-[14px] text-ink no-underline',
    grid
      ? cn('h-10 justify-center rounded-field border text-[14px] font-semibold', option.selected ? 'border-ink bg-ink text-surface' : 'border-line-2 bg-surface hover:border-ink')
      : 'rounded-field px-1 py-1.5 hover:bg-ink/4',
    dead && 'cursor-not-allowed text-ink-3 line-through opacity-60',
  );
  const content = (
    <>
      {grid ? null : <Mark facet={facet} option={option} />}
      <span className={grid ? undefined : 'flex-1'}>{grid ? option.value : option.label}</span>
      {grid ? null : <span className="font-mono text-[12px] text-ink-3">{option.count}</span>}
    </>
  );
  const common = { 'data-facet': facet.name, 'data-value': option.value, 'data-count': option.count, hidden };

  if (dead) {
    return (
      <button type="button" disabled role={role} aria-checked={false} className={cn(row, 'border-0 bg-transparent')} {...common}>
        {content}
      </button>
    );
  }
  if (onToggle) {
    return (
      <button
        type="button"
        role={role}
        aria-checked={option.selected}
        onClick={() => onToggle(facet.name, option.value)}
        className={cn(row, 'bg-transparent', !grid && 'border-0')}
        {...common}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      href={option.href ?? '#'}
      scroll={false}
      role={role}
      aria-checked={option.selected}
      className={row}
      {...common}
    >
      {content}
    </Link>
  );
}

/** Checkbox box, radio circle or colour dot. Decorative: the row text carries the name and state. */
function Mark({ facet, option }: { facet: FacetGroupModel; option: FacetOption }) {
  if (facet.control === 'colour' && option.colour) {
    return (
      <span
        aria-hidden="true"
        className={cn('h-3 w-3 shrink-0 rounded-pill border border-ink/12', option.selected && 'shadow-[0_0_0_2px_var(--canvas),0_0_0_3.5px_var(--ink)]')}
        style={{ background: swatchColour(option.colour) }}
      />
    );
  }
  const radio = facet.control === 'radio';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center border',
        radio ? 'rounded-pill' : 'rounded-[4px]',
        option.selected ? 'border-ink bg-ink text-surface' : 'border-line-2 bg-surface',
      )}
    >
      {option.selected ? <Icon name="check" size={11} /> : null}
    </span>
  );
}
