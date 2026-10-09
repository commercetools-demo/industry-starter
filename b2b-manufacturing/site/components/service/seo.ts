import { COUNTRY_CONFIG } from '@/lib/utils';
import type { Service } from '@/lib/types';
import { siteUrl, type ServiceCategory } from './constants';

export interface Crumb { name: string; path: string }

/** schema.org `Service` for a published service: provider Malva, serviceType = category label, areaServed from the locale. No price (services are quoted). */
export function serviceJsonLd(service: Service, locale: string, categoryLabel: string) {
  const url = `${siteUrl()}/${locale}/${service.category}/${service.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.summary || service.description,
    url,
    serviceType: categoryLabel,
    provider: { '@type': 'Organization', name: 'Malva', url: `${siteUrl()}/${locale}` },
    areaServed: { '@type': 'Country', name: COUNTRY_CONFIG[locale]?.country ?? 'US' },
    ...(service.imageUrl ? { image: service.imageUrl } : {}),
  };
}

/** `BreadcrumbList` that matches the visible trail item for item. */
export function breadcrumbJsonLd(locale: string, trail: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${siteUrl()}/${locale}${c.path}` })),
  };
}

/** JSON for a script tag: `<` is escaped so content cannot close the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const categoryPath = (category: ServiceCategory) => `/${category}`;
