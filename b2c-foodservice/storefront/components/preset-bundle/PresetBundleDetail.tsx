'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import TrustRow from '@/components/pdp/TrustRow';
import { usePathname, useRouter } from '@/i18n/routing';
import { initialPresetOf, machineOf } from '@/lib/preset-bundle/selection';
import { RETURN_DAYS } from '@/lib/shop-config';
import type { BundlePresetView, BundleView, ProductPageData } from '@/lib/types';
import BundleAddToBag from './BundleAddToBag';
import BundleContents from './BundleContents';
import BundleHero from './BundleHero';
import MachinePicker from './MachinePicker';
import PresetPicker from './PresetPicker';

/**
 * The product page of a preset bundle (workstream V, D9). The chosen preset lives in `?preset=<index>` (replaced, not pushed).
 * Renders no `<main>`: the locale layout owns it. Shown instead of the buy box for the bundle shape.
 */
export default function PresetBundleDetail({
  product, bundle, requestedPreset,
}: { product: ProductPageData['product']; bundle: BundleView | null; requestedPreset: number | null }) {
  const t = useTranslations('presetBundle');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const start = bundle ? initialPresetOf(bundle, requestedPreset) : undefined;
  const [index, setIndex] = useState<number | null>(start?.index ?? null);
  const [machineSku, setMachineSku] = useState<string | undefined>(machineOf(start)?.sku);

  if (!bundle || !start) {
    return (
      <section className="mt-6" data-testid="preset-bundle">
        <h1 className="page-title m-0">{product.name}</h1>
        <p className="mt-3 text-[15px] text-ink-2">{t('unavailable')}</p>
      </section>
    );
  }

  const preset = bundle.presets.find((p) => p.index === index) ?? start;
  const machine = machineOf(preset, machineSku);
  const choose = (next: BundlePresetView) => {
    setIndex(next.index);
    setMachineSku(machineOf(next)?.sku);
    router.replace(`${pathname}?preset=${next.index}`);
  };

  return (
    <div className="mt-3.5 grid gap-x-12 gap-y-8 stack:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]" data-testid="preset-bundle" data-locale={locale}>
      <div>
        <BundleHero preset={preset} machine={machine} />
        <BundleContents preset={preset} machine={machine} />
      </div>
      <div>
        <p className="eyebrow m-0">{t('eyebrow')}</p>
        <h1 className="page-title mt-2 m-0">{product.name}</h1>
        <p className="mt-3 text-[15px] text-ink-2">{t('lede')}</p>
        <PresetPicker presets={bundle.presets} selected={preset.index} onSelect={choose} />
        {preset.machines.length > 1 ? (
          <MachinePicker
            machines={preset.machines}
            selected={machine?.sku}
            onSelect={(sku) => setMachineSku(sku)}
          />
        ) : null}
        {preset.available && machine?.price ? (
          <BundleAddToBag
            key={`${preset.index}-${machine.sku}`}
            sku={bundle.sku}
            preset={preset.index}
            machineSku={machine.sku}
            unitCents={machine.price.centAmount}
            currency={machine.price.currencyCode}
          />
        ) : (
          <p className="mt-6 text-[14px] font-semibold text-danger-text">{t('unavailable')}</p>
        )}
        <p className="m-0 mt-3 text-[13px] text-ink-3">{t('together')}</p>
        <TrustRow returnDays={RETURN_DAYS} />
      </div>
    </div>
  );
}
