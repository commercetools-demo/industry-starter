'use client';

import { useLocale, useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { BundlePresetView } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * One preset as a radio card. The input is native (arrow keys, Space and screen readers work without code); the visible card
 * is its next sibling, so the focus ring and the checked state are drawn with `peer-*` (workstream V, D9).
 */
export default function PresetCard({ preset, checked, onSelect }: { preset: BundlePresetView; checked: boolean; onSelect: () => void }) {
  const t = useTranslations('presetBundle');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string } | null) => (m ? formatMoney(m.centAmount, m.currencyCode, locale) : '');
  const reason = preset.unavailableReason === 'out-of-stock' ? t('outOfStock') : t('notInMarket');
  const items = preset.components.filter((c) => c.role === 'item').map((c) => c.name);
  const machine = preset.components.find((c) => c.role === 'machine')?.name ?? '';
  return (
    <label className="block">
      <input
        type="radio"
        name="preset"
        value={preset.index}
        checked={checked}
        disabled={!preset.available}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cn(
          'block rounded-card border border-line bg-canvas p-4 transition-colors',
          'peer-checked:border-ink peer-checked:bg-surface peer-checked:ring-1 peer-checked:ring-ink',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2',
          preset.available ? 'cursor-pointer hover:border-ink' : 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="font-display text-[15px] font-semibold text-ink">{preset.name}</span>
          {preset.available ? <Badge>{t('save', { percent: preset.discountPercent })}</Badge> : null}
        </span>
        <span className="mt-1 block text-[13px] text-ink-3">
          {[machine, ...items.map((i) => `+ ${i}`)].filter(Boolean).join(' ')}
        </span>
        {preset.available ? (
          <span className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
            <span className="font-semibold text-ink">{money(preset.price)}</span>
            {preset.was ? <s className="text-ink-3">{money(preset.was)}</s> : null}
            {preset.save ? <span className="text-ink-3">{t('youSave', { amount: money(preset.save) })}</span> : null}
          </span>
        ) : (
          <span className="mt-2 block text-[13px] font-semibold text-danger-text">{reason}</span>
        )}
      </span>
    </label>
  );
}
