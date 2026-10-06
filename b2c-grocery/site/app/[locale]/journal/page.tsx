import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/content/ContentArticle';
import { Container } from '@/components/layout/Container';
import { ProductTile } from '@/components/product/ProductTile';
import { getPage } from '@/lib/content';
import { searchProducts } from '@/lib/ct/search';
import { getMarket } from '@/lib/session';
import type { Product } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

type PageProps = { params: Promise<{ locale: string }> };

const STORY_PRODUCTS = 4;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage('journal', locale);
  return page ? { title: page.title, description: page.description } : {};
}

/** The market follows the URL locale (D-012), as on the shop page. */
async function marketFor(locale: string) {
  const config = COUNTRY_CONFIG[locale];
  if (config) return { country: config.country, currency: config.currency, locale };
  return { ...(await getMarket()), locale };
}

/** Latest products. A catalogue hiccup must not take the story down: the section is simply omitted. */
async function latestProducts(locale: string): Promise<Product[]> {
  try {
    const result = await searchProducts({ ...(await marketFor(locale)), sort: 'newest', page: 1, pageSize: STORY_PRODUCTS });
    return result.products.slice(0, STORY_PRODUCTS);
  } catch {
    return [];
  }
}

/** Editorial layout: sticky title column on the left, 1.4fr article body on the right, "Shop the story" below. */
export default async function JournalPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [page, t, products] = await Promise.all([getPage('journal', locale), getTranslations({ locale, namespace: 'static' }), latestProducts(locale)]);
  if (!page) notFound();

  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <div className="grid items-start gap-(--space-6) desktop:grid-cols-[1fr_1.4fr] desktop:gap-(--space-8)" data-testid="journal-layout">
        <header className="desktop:sticky desktop:top-[110px]" data-testid="journal-title-column">
          {page.kicker ? <p className="mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{page.kicker}</p> : null}
          <h1 className="m-0 text-[40px] leading-[1.05] tablet:text-[56px]">{page.title}</h1>
        </header>
        <Prose html={page.html} />
      </div>
      {products.length > 0 ? (
        <section className="mt-(--space-8)" aria-labelledby="journal-shop-the-story">
          <h2 id="journal-shop-the-story" className="mb-(--space-4)">
            {t('journal.shopTheStory')}
          </h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-(--space-3) gap-y-(--space-4) p-0 tablet:gap-x-(--space-4) desktop:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductTile product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
