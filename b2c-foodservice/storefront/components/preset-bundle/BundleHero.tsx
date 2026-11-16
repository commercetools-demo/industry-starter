'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import { transformDetailImageUrl } from '@/lib/ct/image-config';
import type { BundleMachineOption, BundlePresetView } from '@/lib/types';

/**
 * The large picture of the chosen bundle: the machine (the chosen variant), with the saving. The change of picture is a
 * short fade; `motion-reduce` switches it off (workstream V, D9).
 */
export default function BundleHero({ preset, machine }: { preset: BundlePresetView; machine: BundleMachineOption | undefined }) {
  const t = useTranslations('presetBundle');
  return (
    <div className="relative aspect-[5/6] overflow-hidden rounded-card bg-canvas-2">
      {machine?.imageUrl ? (
        <Image
          key={machine.sku}
          src={transformDetailImageUrl(machine.imageUrl)}
          alt={machine.imageAlt}
          fill
          sizes="(min-width: 900px) 50vw, 100vw"
          className="object-contain transition-opacity duration-300 motion-reduce:transition-none"
        />
      ) : null}
      <Badge className="absolute left-4 top-4">{t('save', { percent: preset.discountPercent })}</Badge>
    </div>
  );
}
