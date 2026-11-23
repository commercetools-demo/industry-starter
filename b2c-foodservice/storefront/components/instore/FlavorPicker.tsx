'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import OptionButton from '@/components/ui/OptionButton';
import type { FlavorOption } from '@/lib/types';

/**
 * The coffee pod flavor of a ready-made coffee (In-store companion): one flavor out of the drink configuration's flavor category.
 * Each flavor is a big radio-style button; the chosen flavor's description appears under the buttons, so the shopper reads what
 * "Intenso" or "Melozio" means before adding it. Render only: the product page holds the choice.
 */
export default function FlavorPicker({ flavors, value, onChange }: { flavors: FlavorOption[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTranslations('instore.product.flavor');
  const labelId = useId();
  const descriptionId = useId();
  if (flavors.length === 0) return null;
  const chosen = flavors.find((f) => f.id === value);
  return (
    <div className="flex flex-col gap-2.5" data-testid="flavor-picker">
      <p id={labelId} className="m-0 text-[13px] font-semibold text-ink">
        {chosen ? t('titleWithValue', { value: chosen.name }) : t('title')}
        <span className="ml-1.5 font-normal text-ink-3">{t('hint')}</span>
      </p>
      <div role="radiogroup" aria-labelledby={labelId} aria-describedby={descriptionId} className="flex flex-wrap gap-2">
        {flavors.map((f) => (
          <OptionButton
            key={f.id}
            role="radio"
            aria-checked={f.id === value}
            // A radio reports its state with aria-checked, not aria-pressed.
            aria-pressed={undefined}
            selected={f.id === value}
            onClick={() => onChange(f.id)}
            data-flavor={f.id}
            className="h-14 min-w-[64px] px-5 text-[16px]"
          >
            {f.name}
          </OptionButton>
        ))}
      </div>
      <p id={descriptionId} role="status" aria-live="polite" data-testid="flavor-description" className="m-0 min-h-[1.5em] text-[15px] leading-snug text-ink-2">
        {chosen?.description ?? ''}
      </p>
    </div>
  );
}
