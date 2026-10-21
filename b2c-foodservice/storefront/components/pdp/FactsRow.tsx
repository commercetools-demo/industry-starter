'use client';

import { useTranslations } from 'next-intl';
import { usePdp } from '@/components/pdp/pdp-state';
import { cn } from '@/lib/cn';

const INTENSITY_MAX = 13;
const ROAST_LEVELS = ['light', 'medium', 'dark'] as const;

/** 13 segments, filled up to the value. A text alternative states the figure. */
export function IntensityBar({ value }: { value: number }) {
  const t = useTranslations('pdp.facts');
  return (
    <div role="img" aria-label={t('intensityAria', { value })} className="flex items-center gap-[3px]">
      {Array.from({ length: INTENSITY_MAX }, (_, i) => (
        <span key={i} aria-hidden="true" className={cn('h-3 w-[7px] rounded-xs', i < value ? 'bg-ink' : 'bg-line-2')} />
      ))}
    </div>
  );
}

/** Flavour notes as read-only chips. */
export function NoteChips({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {notes.map((n) => (
        <li key={n} className="rounded-pill bg-canvas-2 px-3 py-1 text-[12.5px] text-ink-2">
          {n}
        </li>
      ))}
    </ul>
  );
}

/** Roast as a labelled three-dot scale (light, medium, dark); read-only. */
export function RoastScale({ roastKey, label }: { roastKey: string; label: string }) {
  const level = ROAST_LEVELS.indexOf(roastKey as (typeof ROAST_LEVELS)[number]);
  if (level < 0) return <span className="text-[13px] text-ink-2">{label}</span>;
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
      <span aria-hidden="true" className="flex gap-1">
        {ROAST_LEVELS.map((r, i) => (
          <span key={r} className={cn('h-2.5 w-2.5 rounded-pill', i <= level ? 'bg-ink' : 'bg-line-2')} />
        ))}
      </span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

/** Read-only facts under the price: intensity bar, flavour chips and the roast scale. Nothing renders when there are none. */
export default function FactsRow() {
  const t = useTranslations('pdp.facts');
  const { facts } = usePdp().data.product;
  const hasAny = facts.intensity !== undefined || facts.notes.length > 0 || Boolean(facts.roast);
  if (!hasAny) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="pdp-facts">
      {facts.intensity !== undefined ? (
        <div className="flex items-center gap-3">
          <span className="w-[72px] text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{t('intensity')}</span>
          <IntensityBar value={facts.intensity} />
        </div>
      ) : null}
      {facts.roast ? (
        <div className="flex items-center gap-3">
          <span className="w-[72px] text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{t('roast')}</span>
          <RoastScale roastKey={facts.roastKey ?? ''} label={facts.roast} />
        </div>
      ) : null}
      {facts.notes.length > 0 ? (
        <div className="flex items-start gap-3">
          <span className="w-[72px] shrink-0 pt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{t('notes')}</span>
          <NoteChips notes={facts.notes} />
        </div>
      ) : null}
    </div>
  );
}
