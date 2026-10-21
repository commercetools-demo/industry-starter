import { siteOrigin } from '@/lib/content/seo';
import { searchHref } from '@/lib/routes';

/** Organization and WebSite (with a search action) for the home page. Fixed data and the origin; no user input. */
export function homeStructuredData(locale: string, name: string): Record<string, unknown> {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name, url: origin },
      {
        '@type': 'WebSite',
        name,
        url: `${origin}/${locale}`,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/${locale}${searchHref()}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}
