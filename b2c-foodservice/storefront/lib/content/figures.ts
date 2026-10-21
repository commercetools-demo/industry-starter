import 'server-only';
import { channelFor } from '@/content/contact';
import type { ContentFigures } from '@/lib/content/blocks';
import { getPromiseFigures } from '@/lib/ct/promise';
import { formatMoney, marketForLocale } from '@/lib/utils';

export const FIGURES_TIMEOUT_MS = 800;

/** Neutral phrases used when a figure cannot be had in time (`content.tokenFallback.*`). */
export interface TokenFallbacks {
  freeShipping: string;
  collectMinutes: string;
  returnDays: string;
}

/**
 * Figures for `{{token}}` text, from the same source as the promise bar so pages and the shop cannot disagree.
 * This call never fails a page: 800 ms race, and any error yields the neutral fallback phrases.
 * `supportEmail` and `supportPhone` come from content/contact.ts, not the platform.
 */
export async function getContentFigures(locale: string, fallbacks: TokenFallbacks): Promise<ContentFigures> {
  const market = marketForLocale(locale);
  const channel = channelFor(market.country);
  const base: ContentFigures = {
    ...fallbacks,
    supportEmail: channel.email,
    supportPhone: channel.phone ?? channel.email,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const figures = await Promise.race([
      getPromiseFigures({ country: market.country, currency: market.currency, locale: market.locale }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), FIGURES_TIMEOUT_MS);
      }),
    ]);
    if (!figures) return base;
    return {
      ...base,
      freeShipping: figures.freeShippingThreshold
        ? formatMoney(figures.freeShippingThreshold.centAmount, figures.freeShippingThreshold.currencyCode, locale)
        : base.freeShipping,
      collectMinutes: figures.collectionMinutes !== null ? String(figures.collectionMinutes) : base.collectMinutes,
      returnDays: String(figures.returnDays),
    };
  } catch {
    return base;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
