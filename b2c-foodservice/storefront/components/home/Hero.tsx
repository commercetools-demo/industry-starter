import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import HeroFeaturedCard from '@/components/home/HeroFeaturedCard';
import OpenStoreButton from '@/components/home/OpenStoreButton';
import PromiseRow from '@/components/home/PromiseRow';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';
import { HOME_CONTENT, headlineLines, pick } from '@/content/home';
import { transformDetailImageUrl } from '@/lib/ct/image-config';
import { bestsellersHref } from '@/lib/home-links';
import type { ProductSummary, PromiseFigures } from '@/lib/types';

/**
 * Hero (server). The only `h1` of the page. `collection` is false in a market without stores (Canada): no
 * "Find your store" button and no collect promise. The image column is `display: none` under 900 px.
 */
export default function Hero({
  locale,
  figures,
  featured,
  collection,
}: {
  locale: string;
  figures: PromiseFigures;
  featured: ProductSummary | null;
  collection: boolean;
}) {
  const t = useTranslations('home.hero');
  const content = HOME_CONTENT.hero;
  const imageUrl = content.imageUrl ?? featured?.imageUrl ?? null;
  const lines = headlineLines(pick(content.headline, locale));
  return (
    <section aria-labelledby="home-hero-title" className="home-hero-bg overflow-x-clip">
      <div className="wrap grid min-h-[520px] items-center gap-10 py-10 stack:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] max-xs:py-8">
        <div className="fade-up">
          <p className="eyebrow m-0 mb-4 !text-accent">{pick(content.eyebrow, locale)}</p>
          <h1
            id="home-hero-title"
            className="hero-title m-0 text-ink [letter-spacing:-0.03em] [line-height:0.98]"
          >
            {lines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </h1>
          <p className="mb-0 mt-5 max-w-[440px] text-[18px] leading-normal text-ink-2">{pick(content.subline, locale)}</p>
          <div className="mt-8 flex flex-wrap gap-3 max-xs:flex-col">
            <ButtonLink href={bestsellersHref()} size="lg">
              {t('cta')}
              <Icon name="arrowR" size={18} />
            </ButtonLink>
            {collection ? (
              <OpenStoreButton variant="ghost" size="lg">
                {t('findStore')}
              </OpenStoreButton>
            ) : null}
          </div>
          <PromiseRow figures={figures} locale={locale} collection={collection} />
        </div>
        <div data-testid="hero-media" className="hero-media relative max-stack:hidden">
          <div aria-hidden="true" className="home-glow absolute -inset-10" />
          <div className="relative aspect-[4/4.4] overflow-hidden rounded-hero bg-canvas-2 shadow-lg">
            {imageUrl ? (
              <Image
                src={transformDetailImageUrl(imageUrl)}
                alt={pick(content.imageAlt, locale)}
                fill
                priority
                sizes="560px"
                className="object-cover"
              />
            ) : null}
            {featured ? <HeroFeaturedCard product={featured} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
