'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import ColourSwatches from '@/components/pdp/ColourSwatches';
import GuideModal, { type GuideKind } from '@/components/pdp/GuideModal';
import { usePdp } from '@/components/pdp/pdp-state';
import Icon from '@/components/ui/Icon';
import OptionButton from '@/components/ui/OptionButton';
import { cn } from '@/lib/cn';
import { optionStates, type OptionState } from '@/lib/product/resolve-variant';
import { PACK_LABEL_KEYS } from '@/lib/product/variant-config';
import type { SelectorDef } from '@/lib/types';

/** Which guide link trails which selector: compatibility on the pack (pods) and bundle (machines), grind on the grind. */
function guideFor(attr: string): GuideKind | null {
  if (attr === 'grind') return 'grind';
  if (attr === 'capsulesPerPack' || attr === 'bundle') return 'compat';
  return null;
}

/**
 * One selector of the buy box: label with the selected value, a guide link where one exists, and the options (pills, or
 * colour circles). `?choose=<attr>` (Quick add) highlights the group for 1.2 s, announces "Choose a ..." and moves focus to
 * the first option. Options are real buttons; the arrow keys move focus between enabled options.
 */
export default function OptionGroup({ selector }: { selector: SelectorDef }) {
  const t = useTranslations('pdp');
  const { data, selection, select, fulfilment, store, choose } = usePdp();
  const { product } = data;
  const labelId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [highlight, setHighlight] = useState(choose === selector.attr);

  useEffect(() => {
    if (choose !== selector.attr) return;
    const el = groupRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setHighlight(false), 1200);
    return () => window.clearTimeout(timer);
  }, [choose, selector.attr]);

  const states = optionStates(product.variants, selection, selector, {
    fulfilment,
    ...(store ? { storeChannelId: store.id } : {}),
    ...(product.systemKey ? { systemKey: product.systemKey } : {}),
  });
  const reasonText = (reason: NonNullable<OptionState['reason']>) => t(`option.${reason}`);

  const label = t.has(`selector.label.${selector.attr}`) ? t(`selector.label.${selector.attr}`) : selector.attr;
  const optionLabel = (value: string, fallback: string): string => {
    const n = Number(value);
    if (selector.attr === 'capsulesPerPack' && Number.isFinite(n)) {
      const kind = PACK_LABEL_KEYS[n];
      return kind ? t(`pack.${kind}`, { n }) : t('pack.other', { n });
    }
    if (selector.attr === 'sizeGrams' && Number.isFinite(n)) {
      return n >= 1000 ? t('size.kg', { n: n / 1000 }) : t('size.g', { n });
    }
    return fallback;
  };
  const options = selector.options.map((o) => ({ ...o, label: optionLabel(o.value, o.label) }));
  const selectedValue = selection[selector.attr];
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label;
  const guide = guideFor(selector.attr);
  const choice = t.has(`selector.choice.${selector.attr}`) ? t(`selector.choice.${selector.attr}`) : selector.attr;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"])'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || items.length < 2) return;
    e.preventDefault();
    items[(at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={groupRef}
      data-attr={selector.attr}
      data-highlight={highlight || undefined}
      className={cn(
        'transition-state flex flex-col gap-2.5 rounded-card',
        highlight && 'ring-2 ring-accent ring-offset-4 ring-offset-canvas',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="m-0 text-[13px] font-semibold text-ink">
          {selectedLabel ? t('selector.groupValue', { label, value: selectedLabel }) : label}
        </p>
        {guide ? (
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            <Icon name="ruler" size={15} />
            {t(guide === 'grind' ? 'guide.grind.link' : 'guide.compat.link')}
          </button>
        ) : null}
      </div>
      {highlight ? (
        <p role="status" aria-live="polite" className="sr-only">
          {t('selector.choose', { choice })}
        </p>
      ) : null}
      {selector.renderer === 'colour' ? (
        <ColourSwatches
          labelledBy={labelId}
          options={options}
          states={states}
          selected={selectedValue}
          reasonText={reasonText}
          onSelect={(v) => select(selector.attr, v)}
        />
      ) : (
        <div role="group" aria-labelledby={labelId} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
          {options.map((o) => {
            const state = states.find((s) => s.value === o.value);
            const common = { selected: selectedValue === o.value, onClick: () => select(selector.attr, o.value), 'data-value': o.value };
            return state?.disabled ? (
              <OptionButton key={o.value} {...common} disabled disabledReason={reasonText(state.reason ?? 'noVariant')}>
                {o.label}
              </OptionButton>
            ) : (
              <OptionButton key={o.value} {...common}>
                {o.label}
              </OptionButton>
            );
          })}
        </div>
      )}
      {guide ? <GuideModal kind={guide} open={guideOpen} onClose={() => setGuideOpen(false)} links={data.guideLinks} /> : null}
    </div>
  );
}
