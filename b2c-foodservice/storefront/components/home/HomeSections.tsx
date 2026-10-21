import { getTranslations } from 'next-intl/server';
import ProductSection from '@/components/home/ProductSection';
import SubscribeStrip from '@/components/home/SubscribeStrip';
import { countSubscribable, searchHomeProducts, type HomeCtx } from '@/lib/home-data';
import { bestsellersHref, newArrivalsHref } from '@/lib/home-links';
import type { Category, Store } from '@/lib/types';

interface SectionProps {
  ctx: HomeCtx;
  tree: Category[];
  store: Store | null;
}

// Async wrappers: each fetches its own data inside its own Suspense boundary, so hero, tiles and banner never wait for
// products and one slow or failing section affects only itself.

export async function BestsellersSection({ ctx, tree, store }: SectionProps) {
  const [t, products] = await Promise.all([
    getTranslations({ locale: ctx.locale, namespace: 'home.bestsellers' }),
    searchHomeProducts('bestseller', ctx, tree, store),
  ]);
  return (
    <ProductSection id="home-bestsellers" eyebrow={t('eyebrow')} title={t('title')} viewAllHref={bestsellersHref()} products={products} />
  );
}

export async function NewArrivalsSection({ ctx, tree, store }: SectionProps) {
  const [t, products] = await Promise.all([
    getTranslations({ locale: ctx.locale, namespace: 'home.new' }),
    searchHomeProducts('new', ctx, tree, store),
  ]);
  return (
    <ProductSection
      id="home-new"
      eyebrow={t('eyebrow')}
      title={t('title')}
      viewAllHref={newArrivalsHref()}
      products={products}
      accentEyebrow
    />
  );
}

export async function SubscribeSection({ ctx }: { ctx: HomeCtx }) {
  return <SubscribeStrip available={(await countSubscribable(ctx)) > 0} />;
}
