'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { FlavorOption } from '@/lib/types';

const SCALE = 11;

/**
 * The coffee pod flavor of a ready-made coffee (In-store companion): one flavor out of the drink configuration's flavor category,
 * as swipeable cards (name, roast intensity as dots). The chosen flavor's description appears under the cards, so the shopper reads
 * what "Intenso" or "Melozio" means before adding it. Render only: the product page holds the choice.
 */
export default function FlavorPicker({ flavors, value, onChange }: { flavors: FlavorOption[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTranslations('instore.product.flavor');
  const labelId = useId();
  const descriptionId = useId();
  if (flavors.length === 0) return null;
  const chosen = flavors.find((f) => f.id === value);
  return (
    <div className="flex flex-col gap-1" data-testid="flavor-picker">
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="m-0 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-2">
          {chosen ? t('titleWithValue', { value: chosen.name }) : t('title')}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-3">{t('hint')}</span>
        </p>
        <span className="shrink-0 text-[12px] text-ink-3">{t('swipe')}</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className="-mx-6 grid snap-x snap-mandatory auto-cols-[136px] grid-flow-col gap-3 overflow-x-auto px-6 pb-6 pt-3.5"
      >
        {flavors.map((f) => {
          const on = f.id === value;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(f.id)}
              data-flavor={f.id}
              className={cn(
                'transition-press relative flex min-w-0 snap-start flex-col gap-2.5 rounded-card border border-line bg-surface p-2.5 text-left text-ink',
                on && 'outline outline-[3px] -outline-offset-1 outline-ink',
              )}
            >
              <span className="block h-1.5 rounded-pill bg-accent" aria-hidden="true" />
              <span className="flex-1 font-display text-[15px] font-bold leading-tight">{f.name}</span>
              {f.intensity !== undefined ? (
                <span className="flex flex-col gap-1.5 text-[11px] font-medium text-ink-3">
                  <span>{t('intensity', { n: f.intensity, max: SCALE })}</span>
                  <span className="flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: SCALE }, (_, k) => (
                      <span key={k} className={cn('h-[7px] w-[7px] rounded-pill', k < f.intensity! ? 'bg-accent' : 'bg-line')} />
                    ))}
                  </span>
                </span>
              ) : null}
              {on ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-pill border-2 border-canvas bg-accent text-surface" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p id={descriptionId} role="status" aria-live="polite" data-testid="flavor-description" className="m-0 min-h-[1.5em] text-[14px] italic leading-relaxed text-ink-2">
        {chosen?.description ?? ''}
      </p>
    </div>
  );
}
