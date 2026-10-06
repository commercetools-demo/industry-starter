import { setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/Container';
import { CategoryShowcase } from '@/components/home/CategoryShowcase';
import { ContactStrip } from '@/components/home/ContactStrip';
import { EditorialPanel } from '@/components/home/EditorialPanel';
import { Hero } from '@/components/home/Hero';
import { NewIn } from '@/components/home/NewIn';
import { getSiteConfig } from '@/lib/config/site';
import { getCategoryTree } from '@/lib/ct/categories';
import { searchProducts } from '@/lib/ct/search';
import { buildShowcaseItems } from '@/lib/home-view';
import { getMarket } from '@/lib/session';
import { COUNTRY_CONFIG } from '@/lib/utils';

// The layout switches are read from the environment on every request (not at build time).
export const dynamic = 'force-dynamic';

/** The market follows the URL locale (D-012); only an unknown locale falls back to the session market. */
async function marketFor(locale: string) {
  const config = COUNTRY_CONFIG[locale];
  if (config) return { country: config.country, currency: config.currency, locale };
  return { ...(await getMarket()), locale };
}

/**
 * Shared merchandising only: the body is identical for every visitor in a market. Bag count and account identity come
 * from the header slots in the layout; this page never reads the cart or the customer.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const config = getSiteConfig();
  const market = await marketFor(locale);
  const [tree, newest] = await Promise.all([getCategoryTree(locale), searchProducts({ ...market, sort: 'newest', pageSize: 4 })]);

  return (
    <Container className="pb-[120px]">
      <Hero layout={config.homeLayout} imageUrl={config.heroImageUrl} />
      <div className="mt-[56px] flex flex-col gap-[56px]">
        {/* The facets of the newest-first search cover the whole catalog, so they give the category counts. */}
        <CategoryShowcase items={buildShowcaseItems(tree, newest.facets)} />
        <NewIn products={newest.products} />
        <EditorialPanel />
        {config.contactStrip ? <ContactStrip /> : null}
      </div>
    </Container>
  );
}
