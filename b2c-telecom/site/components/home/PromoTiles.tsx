import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING, FOCUS_RING_ON_DARK } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { HOME_CONFIG, type PromoTileConfig } from '@/lib/config/home';
import { formatMoney } from '@/lib/format';
import { resolveBanner } from '@/lib/home/derive';
import { categoryPath } from '@/lib/listing/links';
import type { Category, Locale, Money } from '@/lib/types';

type PromoTilesProps = {
  locale: Locale;
  tree: Category[];
  /** Lowest phone plan price; null hides the amount from the title. */
  phonePrice: Money | null;
  /** Names of the first popular add-ons (the first two are named in the add-ons tile). */
  addonNames: string[];
};

const TONE = {
  dark: {
    tile: 'bg-pink-900 text-text-on-pink',
    eyebrow: 'text-pink-200',
    cta: cx('bg-brand-500 text-brand-950', FOCUS_RING_ON_DARK),
  },
  light: {
    tile: 'bg-brand-100 text-text',
    eyebrow: 'text-brand-800',
    cta: cx('bg-action text-text-on-pink hover:bg-action-hover', FOCUS_RING),
  },
} as const;

function Tile({ config, locale, tree, phonePrice, addonNames }: PromoTilesProps & { config: PromoTileConfig }): ReactElement | null {
  const t = useTranslations('home.promo');
  const banner = resolveBanner(tree, config.categoryKey);
  const href = banner ? categoryPath(banner.category.key, locale, tree) : undefined;
  if (!href) return null;
  const tone = TONE[config.tone];
  const names = addonNames.slice(0, 2).join(', ');
  const title =
    config.id === 'phone'
      ? phonePrice
        ? t('phone.title', { price: formatMoney(phonePrice, locale) })
        : t('phone.titleNoPrice')
      : names
        ? t('addons.title', { names })
        : t('addons.titleNoNames');
  return (
    <li className={cx('flex flex-col items-start gap-5 rounded-xl p-(--ext-space-36)', tone.tile)} data-tone={config.tone}>
      <p className={cx('m-0 font-display text-sm font-semibold uppercase tracking-[calc(var(--tracking-ui)*2)]', tone.eyebrow)}>{t(`${config.id}.eyebrow`)}</p>
      <h2 className="m-0 font-display text-(length:--ext-text-30) leading-[1.15] font-bold">{title}</h2>
      <Link
        href={href}
        className={cx('inline-flex min-h-11 items-center justify-center rounded-pill px-8 font-cta text-md font-extrabold no-underline', tone.cta)}
      >
        {t(`${config.id}.cta`)}
      </Link>
    </li>
  );
}

/** The two promo tiles under the hero. A tile whose category does not resolve is omitted (and logged). */
export function PromoTiles(props: PromoTilesProps): ReactElement {
  return (
    <section className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
      <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        {HOME_CONFIG.promoTiles.map((config) => (
          <Tile key={config.id} config={config} {...props} />
        ))}
      </ul>
    </section>
  );
}
