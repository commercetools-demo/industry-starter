'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { useRouter } from '@/i18n/routing';
import { useOverlay } from '@/context/OverlayContext';
import { usePalette } from '@/context/PaletteContext';
import { useToast } from '@/context/ToastContext';
import { lookupParts } from '@/hooks/usePartSearch';
import { resolveEnter } from '@/lib/portal/search';

/**
 * Top-bar field for part number, OE number or VIN. Enter on an exact SKU or OE match opens the catalog filter
 * (`/catalog?tab=assortment&sku=<sku>`); a VIN-shaped entry explains that vehicle lookup is off (Q-R09); anything else
 * opens the palette prefilled.
 */
export function TopSearch() {
  const t = useTranslations('shell');
  const router = useRouter();
  const overlay = useOverlay();
  const palette = usePalette();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const q = value.trim();
      const result = resolveEnter(q, q.length >= 2 ? await lookupParts(q) : []);
      if (result.kind === 'navigate') {
        setValue('');
        router.push(result.href);
      } else if (result.kind === 'vin') toast(t('vinInfo'));
      else if (result.kind === 'palette') {
        palette.setQuery(result.prefill);
        overlay.open('cmd');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="search" className="flex h-1100 w-full max-w-widget-tablet-5col min-w-0 items-center gap-250 rounded-300 border border-border-on bg-bg-brand px-300">
      <Icon name="search" size="sm" />
      <input
        type="search"
        data-testid="top-search"
        aria-label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-body-1 font-semibold text-text-on placeholder:text-text-disabled focus-visible:shadow-none"
      />
    </div>
  );
}
