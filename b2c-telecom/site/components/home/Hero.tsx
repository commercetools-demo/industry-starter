import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { HOME_CONFIG } from '@/lib/config/home';
import { formatMoney } from '@/lib/format';
import { resolveBanner, type HeroFacts } from '@/lib/home/derive';
import { categoryPath } from '@/lib/listing/links';
import type { Category, Locale } from '@/lib/types';
import { HeroImage } from './HeroImage';

type HeroProps = { locale: Locale; tree: Category[]; facts: HeroFacts };

/** Gradient hero (design/specs/homepage.md). Without a resolvable target category the CTA is omitted. */
export function Hero({ locale, tree, facts }: HeroProps): ReactElement {
  const t = useTranslations('home.hero');
  const banner = resolveBanner(tree, HOME_CONFIG.hero.categoryKey);
  const href = banner ? categoryPath(banner.category.key, locale, tree) : undefined;
  const { speed, price, months } = facts;
  const sub =
    speed && price
      ? t(months > 0 ? 'sub' : 'subNoLock', { speed: t(`speed.${speed.unit}`, { value: speed.value }), price: formatMoney(price, locale), months })
      : null;
  return (
    <section className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
      <div className="grid items-center gap-10 rounded-xl bg-(image:--color-brand-gradient) p-8 text-text-on-brand md:grid-cols-[1.2fr_1fr] md:p-(--ext-space-64)">
        <div className="flex flex-col items-start gap-5">
          <p className="m-0 font-display text-sm font-semibold uppercase tracking-[calc(var(--tracking-ui)*2)]">{t('eyebrow')}</p>
          <h1 className="m-0 font-display text-4xl leading-[1.05] font-bold md:text-(length:--ext-text-56)">{t('title')}</h1>
          {sub ? <p className="m-0 max-w-120 text-lg leading-normal">{sub}</p> : null}
          {href ? (
            <Button href={href} variant="primary">
              {t('cta')}
            </Button>
          ) : null}
        </div>
        <HeroImage url={banner?.category.image ?? null} alt={banner?.category.imageAlt ?? t('imageAlt')} />
      </div>
    </section>
  );
}
