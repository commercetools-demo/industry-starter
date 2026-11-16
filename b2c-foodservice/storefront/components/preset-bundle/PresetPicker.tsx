'use client';

import { useTranslations } from 'next-intl';
import PresetCard from './PresetCard';
import type { BundlePresetView } from '@/lib/types';

/** The presets as one radio group: a fieldset with its legend, one card per preset (workstream V, D9). */
export default function PresetPicker({
  presets, selected, onSelect,
}: { presets: BundlePresetView[]; selected: number | null; onSelect: (preset: BundlePresetView) => void }) {
  const t = useTranslations('presetBundle');
  return (
    <fieldset className="m-0 mt-6 border-0 p-0">
      <legend className="mb-3 p-0 text-[13px] font-semibold text-ink-2">{t('legend')}</legend>
      <div className="flex flex-col gap-3">
        {presets.map((p) => (
          <PresetCard key={p.index} preset={p} checked={p.index === selected} onSelect={() => onSelect(p)} />
        ))}
      </div>
    </fieldset>
  );
}
