'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { usePdp } from '@/components/pdp/pdp-state';
import OptionButton from '@/components/ui/OptionButton';

/**
 * Ready-made coffee: the modifiers the drink's configuration offers (milks, coffees), any number of them. Each is a toggle
 * button (`aria-pressed`). The drink is added at its own price; the chosen modifiers travel on the line (`modifiers`).
 * `large`: the In-store companion's bigger buttons.
 */
export default function ModifierPicker({ large = false }: { large?: boolean }) {
  const t = useTranslations('pdp.modifiers');
  const { data, modifiers, toggleModifier } = usePdp();
  const labelId = useId();
  const options = data.modifiers ?? [];
  if (options.length === 0) return null;
  const chosen = options.filter((o) => modifiers.includes(o.id)).map((o) => o.name);
  return (
    <div className="flex flex-col gap-2.5" data-testid="modifier-picker">
      <p id={labelId} className="m-0 text-[13px] font-semibold text-ink">
        {chosen.length > 0 ? t('titleWithValue', { value: chosen.join(', ') }) : t('title')}
        <span className="ml-1.5 font-normal text-ink-3">{t('hint')}</span>
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <OptionButton
            key={o.id}
            selected={modifiers.includes(o.id)}
            onClick={() => toggleModifier(o.id)}
            data-modifier={o.id}
            {...(large ? { className: 'h-14 min-w-[64px] px-5 text-[16px]' } : {})}
          >
            {o.name}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}
