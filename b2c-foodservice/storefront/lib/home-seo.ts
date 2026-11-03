import { DEFAULT_BRAND, type BrandSlug } from '@/lib/brands';
import { siteOrigin } from '@/lib/content/seo';
import { searchHref } from '@/lib/routes';

/** Organization and WebSite (with a search action) for the home page. Fixed data and the origin; no user input. */
export function homeStructuredData(locale: string, name: string, brand: BrandSlug = DEFAULT_BRAND): Record<string, unknown> {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name, url: origin },
      {
        '@type': 'WebSite',
        name,
        url: `${origin}/${brand}/${locale}`,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/${brand}/${locale}${searchHref()}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}
