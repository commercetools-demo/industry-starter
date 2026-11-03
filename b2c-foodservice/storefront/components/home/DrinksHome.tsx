import { Fragment, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import CategoryTiles from '@/components/home/CategoryTiles';
import ProductSection from '@/components/home/ProductSection';
import { ProductSectionSkeleton } from '@/components/home/HomeSkeletons';
import PromiseRow from '@/components/home/PromiseRow';
import ButtonLink from '@/components/ui/ButtonLink';
import { BRANDS } from '@/lib/brands';
import { searchBrandRange, type HomeCtx } from '@/lib/home-data';
import type { Category, PromiseFigures, Store } from '@/lib/types';

const lines = (text: string): string[] => text.split('\n');

function Headline({ text }: { text: string }) {
  return lines(text).map((line, i) => (
    <Fragment key={line}>
      {i > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

function Hero({ figures, locale }: { figures: PromiseFigures; locale: string }) {
  const t = useTranslations('home.drinks.hero');
  return (
    <section aria-labelledby="home-hero-title" className="home-hero-bg overflow-x-clip">
      <div className="wrap grid min-h-[420px] items-center gap-10 py-10 max-xs:py-8">
        <div className="fade-up">
          <p className="eyebrow m-0 mb-4 !text-accent-press">{t('eyebrow')}</p>
          <h1 id="home-hero-title" className="hero-title m-0 text-ink [letter-spacing:-0.03em] [line-height:0.98]">
            <Headline text={t('headline')} />
          </h1>
          <p className="mb-0 mt-5 max-w-[480px] text-[18px] leading-normal text-ink-2">{t('subline')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/shop" variant="ink" size="lg">
              {t('cta')}
            </ButtonLink>
          </div>
          {/* No collection promise: Malva Drinks is delivered only. */}
          <PromiseRow figures={figures} locale={locale} collection={false} />
        </div>
      </div>
    </section>
  );
}

function Story() {
  const t = useTranslations('home.drinks.story');
  return (
    <section aria-labelledby="home-story-title" className="bg-canvas-2 home-section">
      <div className="wrap max-w-[760px]">
        <p className="eyebrow m-0 mb-3 !text-ink-2">{t('eyebrow')}</p>
        <h2 id="home-story-title" className="m-0 font-display text-[36px] font-bold leading-[1.1] tracking-[-0.02em] text-ink max-mobile:text-[27px]">
          <Headline text={t('title')} />
        </h2>
        <p className="mb-0 mt-4 text-[16px] leading-relaxed text-ink-2">{t('body')}</p>
        <div className="mt-7">
          <ButtonLink href="/shop" variant="ink">
            {t('cta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

async function RangeSection({ ctx, tree, store }: { ctx: HomeCtx; tree: Category[]; store: Store | null }) {
  const [t, products] = await Promise.all([
    getTranslations({ locale: ctx.locale, namespace: 'home.drinks.range' }),
    searchBrandRange(ctx, tree, store),
  ]);
  return <ProductSection id="home-range" eyebrow={t('eyebrow')} title={t('title')} viewAllHref="/shop" products={products} />;
}

/**
 * The Malva Drinks home page (server): hero without a collection promise, a tile per product line, the range, a short story.
 * Same layout language and components as the coffee home; only the content and the tokens (colour) differ.
 */
export default function DrinksHome({ locale, figures, tree, ctx }: { locale: string; figures: PromiseFigures; tree: Category[]; ctx: HomeCtx }) {
  return (
    <div data-brand-home="malva-drinks">
      <Hero figures={figures} locale={locale} />
      <CategoryTiles tree={tree} keys={BRANDS['malva-drinks'].tileCategoryKeys ?? []} />
      <Suspense fallback={<ProductSectionSkeleton />}>
        <RangeSection ctx={ctx} tree={tree} store={null} />
      </Suspense>
      <Story />
    </div>
  );
}
