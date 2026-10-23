'use client';

import { swatchBackground } from '@/components/ui/ColorSwatch';
import { cn } from '@/lib/cn';
import type { OptionState } from '@/lib/product/resolve-variant';

export interface ColourSwatchesProps {
  /** Id of the element that names the group. */
  labelledBy: string;
  options: { value: string; label: string }[];
  states: OptionState[];
  selected: string | undefined;
  /** Title text per disabled reason. */
  reasonText: (reason: NonNullable<OptionState['reason']>) => string;
  onSelect: (value: string) => void;
}

/**
 * Colour options as 42 px circles; the selected one gets the ring (2 px canvas, 4 px ink). A radiogroup: each swatch is
 * a `radio` named by its colour. A disabled colour keeps `aria-disabled` and its reason in the title, so it stays reachable.
 * An unknown colour key falls back to the neutral swatch token and still shows its label as text.
 */
export default function ColourSwatches({ labelledBy, options, states, selected, reasonText, onSelect }: ColourSwatchesProps) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-3">
      {options.map((o) => {
        const state = states.find((s) => s.value === o.value);
        const disabled = state?.disabled ?? false;
        const checked = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.label}
            aria-disabled={disabled ? 'true' : undefined}
            title={disabled && state?.reason ? reasonText(state.reason) : o.label}
            data-colour={o.value}
            onClick={() => {
              if (!disabled) onSelect(o.value);
            }}
            style={{ background: swatchBackground(o.value) }}
            className={cn(
              'transition-press h-[42px] w-[42px] shrink-0 rounded-pill border border-ink/12 p-0',
              checked && 'shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--ink)]',
              disabled ? 'cursor-not-allowed opacity-40' : 'hover:scale-105',
            )}
          />
        );
      })}
    </div>
  );
}
