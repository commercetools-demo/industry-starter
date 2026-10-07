'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useDiscountPrompts, type AddLineArgs } from '@/hooks/useCart';
import { formatMoneyExact } from '@/lib/format';
import type { Cart, Locale } from '@/lib/types';

type DiscountPromptsProps = {
  cart: Cart;
  /** Adds the suggested line (the page's busy/notice handling wraps it). */
  onAdd: (args: AddLineArgs, name: string) => Promise<void>;
  busy?: boolean;
};

/**
 * The offer that would activate a discount the buyer can really get, with the saving it would unlock per month (D-027). The server prices
 * every suggestion from a prospective cart on every cart version; prompts only ever suggest ADDING a line.
 */
export function DiscountPrompts({ cart, onAdd, busy = false }: DiscountPromptsProps): ReactElement | null {
  const t = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const { prompts } = useDiscountPrompts(cart);
  if (prompts.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label={t('prompt.region')}>
      {prompts.map((prompt) => {
        const saving = formatMoneyExact(prompt.saving, locale);
        return (
          <li key={prompt.pairingKey} className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-pink-50 p-6">
            <div className="min-w-48 flex-1">
              <div className="font-display text-lg font-bold">{t('prompt.title', { saving })}</div>
              <p className="m-0 text-md">{t(prompt.messageKey.replace(/^bundle\./, ''), { ...prompt.params, saving })}</p>
            </div>
            <Button
              disabled={busy}
              aria-label={t('prompt.addAria', { name: prompt.candidate.name, saving })}
              onClick={() => void onAdd({ offerKey: prompt.candidate.offerKey, sku: prompt.candidate.sku, quantity: prompt.candidate.quantity }, prompt.candidate.name)}
            >
              {t('prompt.add')}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
