'use client';

import { useTranslations } from 'next-intl';
import OptionButton from '@/components/ui/OptionButton';
import type { BundleMachineOption } from '@/lib/types';

/** The machine variant of the chosen preset (D-059): one option per variant. A variant that cannot be bought is disabled. */
export default function MachinePicker({
  machines, selected, onSelect,
}: { machines: BundleMachineOption[]; selected: string | undefined; onSelect: (sku: string) => void }) {
  const t = useTranslations('presetBundle');
  return (
    <fieldset className="m-0 mt-5 border-0 p-0">
      <legend className="mb-2 p-0 text-[13px] font-semibold text-ink-2">{t('machine')}</legend>
      <div className="flex flex-wrap gap-2">
        {machines.map((m) => {
          const buyable = m.price !== null && m.inStock;
          return (
            <OptionButton
              key={m.sku}
              selected={m.sku === selected}
              {...(buyable
                ? { disabled: false as const }
                : { disabled: true as const, disabledReason: m.inStock ? t('notInMarket') : t('outOfStock') })}
              onClick={() => onSelect(m.sku)}
            >
              {m.label}
            </OptionButton>
          );
        })}
      </div>
    </fieldset>
  );
}
